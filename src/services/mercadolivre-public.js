// ============================================
// Coletor público do Mercado Livre
// Lê as Ofertas do Dia em mercadolivre.com.br/ofertas.
// Sem OAuth, sem chave de API e sem navegador headless.
//
// Por que a busca por termo saiu daqui:
//   - api.mercadolibre.com/sites/MLB/search responde 403 "forbidden" para
//     chamadas anônimas desde que o Mercado Livre fechou o catálogo público;
//   - lista.mercadolivre.com.br redireciona para /gz/account-verification,
//     ou seja, pede login mesmo em navegador real com user-agent de Chrome.
// A página de ofertas continua aberta e já traz o preço anterior de cada
// item, que é exatamente o dado necessário para calcular o desconto.
// ============================================

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { isQuietHour } = require('../utils/horario');
const logger = require('../utils/logger');
const { enqueue } = require('./queue');
const { keepOnlyRealDeals } = require('./price-history');
const { recordCycle } = require('./health');

const OFFERS_URL = 'https://www.mercadolivre.com.br/ofertas';
// A página embute o estado do React como `_n.ctx.r={...};_n.ctx.r.assets...`.
const STATE_PREFIX = '_n.ctx.r=';
const STATE_SUFFIX = '};_n.ctx.r';
const SEEN_FILE = path.resolve(__dirname, '../../.mercadolivre_seen.json');
const MAX_SEEN_ITEMS = 5000;
const REQUEST_TIMEOUT_MS = 30000;
// Sem um user-agent de navegador o Mercado Livre devolve página de bloqueio.
const REQUEST_HEADERS = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};
// Valores aceitos em ML_PUBLIC_CATEGORIES para pedir o feed sem filtro.
const ALL_CATEGORIES = new Set(['todas', 'geral', 'all']);

let timer = null;
let running = false;
let seen = new Map();
let nextCategoryIndex = 0;

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getDiscountPercent(originalPrice, currentPrice) {
  if (!Number.isFinite(originalPrice) || !Number.isFinite(currentPrice) || originalPrice <= currentPrice || originalPrice <= 0) {
    return 0;
  }
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}

/**
 * Minúsculas, sem acento e sem pontuação, para comparar título de produto
 * com palavra-chave sem depender de como cada um foi escrito.
 */
function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Sem palavras-chave configuradas, toda oferta da categoria é aceita.
 * Com palavras-chave, basta uma delas casar — e para casar, todas as
 * palavras dela precisam aparecer no título.
 */
function matchesKeywords(title, keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) return true;

  const words = normalizeText(title).split(' ').filter(Boolean);
  const titleWords = new Set(words);
  return keywords.some((keyword) => {
    const keywordWords = normalizeText(keyword).split(' ').filter(Boolean);
    if (keywordWords.length === 0) return false;
    return keywordWords.every((word) => titleWords.has(word));
  });
}

function buildOffersUrl(category, page = 1) {
  const url = new URL(OFFERS_URL);
  if (category && !ALL_CATEGORIES.has(String(category).toLowerCase())) {
    url.searchParams.set('category', category);
  }
  if (page > 1) url.searchParams.set('page', String(page));
  return url.toString();
}

/**
 * Recorta o JSON de renderização embutido na página de ofertas.
 * Devolve null quando o Mercado Livre muda o formato da página.
 */
function extractOffersState(html) {
  const open = html.indexOf(STATE_PREFIX);
  if (open === -1) return null;
  const close = html.indexOf(STATE_SUFFIX, open);
  if (close === -1) return null;
  try {
    return JSON.parse(html.slice(open + STATE_PREFIX.length, close + 1));
  } catch (error) {
    return null;
  }
}

function findComponent(card, type) {
  const components = [...(card.components || []), ...(card.widget_components || [])];
  return components.find((component) => component && component.type === type) || null;
}

/**
 * Os textos do feed vêm como template com marcadores — "TNT Info {icon}",
 * "{o} {price_total} {en} 10x {price} sem juros". Trocamos o que dá por
 * valor e apagamos o resto, em vez de mandar chave crua para o grupo.
 */
function renderTemplate(bloco) {
  if (!bloco || !bloco.text) return '';
  let texto = String(bloco.text);
  for (const valor of bloco.values || []) {
    let substituto = '';
    if (valor.type === 'label') substituto = valor.label?.text || '';
    else if (valor.type === 'price') substituto = formatCurrency(Number(valor.price?.value));
    else if (valor.type === 'pill') substituto = valor.pill?.text || '';
    texto = texto.split(`{${valor.key}}`).join(substituto);
  }
  return texto.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Cupom que o próprio anúncio oferece, no formato "R$ 159,62 com Cupom".
 */
function readCoupon(card) {
  const promocoes = findComponent(card, 'promotions')?.promotions;
  if (!Array.isArray(promocoes)) return null;
  const cupom = promocoes.find((p) => p && p.type === 'coupon');
  return cupom ? renderTemplate(cupom) : null;
}

/**
 * O preço anterior vem dentro de price_labels, marcado com `previous: true`.
 * Item sem preço anterior é item sem desconto declarado.
 */
function readPreviousPrice(price) {
  for (const label of price.price_labels || []) {
    for (const value of label.values || []) {
      if (value && value.type === 'price' && value.price && value.price.previous) {
        return Number(value.price.value);
      }
    }
  }
  return null;
}

/**
 * Converte um card do feed no mesmo formato que a antiga API devolvia,
 * para que toPromo continue servindo aos dois caminhos.
 */
function toOfferItem(entry) {
  const card = (entry && entry.card) || {};
  const metadata = card.metadata || {};
  const title = findComponent(card, 'title')?.title?.text;
  const price = findComponent(card, 'price')?.price;
  if (!metadata.id || !metadata.url || !title || !price) return null;

  // metadata.url vem sem protocolo e sem os parâmetros de rastreio.
  const permalink = metadata.url.startsWith('http') ? metadata.url : `https://${metadata.url}`;
  const enviadoDe = renderTemplate(findComponent(card, 'shipped_from')?.shipped_from);
  const internacional = !!findComponent(card, 'cbt');

  return {
    id: metadata.id,
    title,
    permalink,
    price: Number(price.current_price?.value),
    original_price: readPreviousPrice(price),
    imageUrl: buildPictureUrl(card.pictures?.pictures?.[0]?.id),
    seller: renderTemplate(findComponent(card, 'seller')?.seller) || null,
    shipping: renderTemplate(findComponent(card, 'shipping_v2')?.shipping_v2?.[0]) || null,
    installments: renderTemplate(price.installments) || null,
    // "Disponível em 3 cores" — o aviso que evita anunciar uma versão e a
    // pessoa achar que o preço vale para todas.
    variants: findComponent(card, 'variations_text')?.variations_text?.text || null,
    coupon: readCoupon(card),
    origin: internacional || /china|exterior|internacional/i.test(enviadoDe) ? 'internacional' : 'nacional',
    shippedFrom: enviadoDe || null,
    rating: readRating(card),
    sales: readSales(card),
  };
}

/**
 * A avaliação e a quantidade vendida vêm juntas num texto só, do tipo
 * "Classificação 4.9 de 5 estrelas. Mais de 500 produtos vendidos."
 */
function readRating(card) {
  const alt = findComponent(card, 'review_compacted')?.review_compacted?.alt_text || '';
  const nota = alt.match(/([\d,.]+)\s*de\s*5/i);
  return nota ? nota[1].replace(',', '.') : null;
}

function readSales(card) {
  const alt = findComponent(card, 'review_compacted')?.review_compacted?.alt_text || '';
  const vendidos = alt.match(/((?:mais de\s*)?[\d.,]+\s*(?:mil\s*)?produtos vendidos)/i);
  return vendidos ? vendidos[1].replace(/produtos vendidos/i, 'vendidos') : null;
}

/**
 * O feed traz só o id da foto; a URL é montada a partir dele.
 *
 * O sufixo -O.jpg em vez de -F.webp é intencional: a CDN do Mercado
 * Livre devolve WEBP mesmo quando o cabeçalho pede jpeg, e a marca
 * d'água não abre WEBP. Pela URL, ela entrega JPEG.
 */
function buildPictureUrl(pictureId) {
  return pictureId ? `https://http2.mlstatic.com/D_NQ_NP_2X_${pictureId}-O.jpg` : null;
}

/**
 * Lê os itens da página de ofertas.
 * Devolve null quando o bloco de dados não pôde ser lido — diferente de []
 * que significa "página lida, nenhum item".
 */
function readOffers(html) {
  const state = extractOffersState(html);
  const items = state?.appProps?.pageProps?.data?.items;
  if (!Array.isArray(items)) return null;
  return items.map(toOfferItem).filter(Boolean);
}

function toPromo(item) {
  const originalPrice = Number(item.original_price);
  const currentPrice = Number(item.price);
  const discountPercent = getDiscountPercent(originalPrice, currentPrice);

  if (!item.id || !item.title || !item.permalink || discountPercent < config.mercadoLivreMinDiscount) {
    return null;
  }

  return {
    id: item.id,
    title: item.title,
    urls: [item.permalink],
    prices: [formatCurrency(originalPrice), formatCurrency(currentPrice)],
    originalPrice: formatCurrency(originalPrice),
    currentPrice: formatCurrency(currentPrice),
    priceValue: currentPrice,
    media: null,
    imageUrl: item.imageUrl || null,
    store: 'Mercado Livre',
    seller: item.seller || null,
    shipping: item.shipping || null,
    installments: item.installments || null,
    variants: item.variants || null,
    // O feed só oferece o preço da versão mais barata quando o anúncio tem
    // variações, então o valor é um piso, não o preço de qualquer versão.
    priceFromVariant: !!item.variants,
    origin: item.origin || null,
    taxNote: item.origin === 'internacional'
      ? `Importado${item.shippedFrom ? ` (${item.shippedFrom})` : ''} — o valor acima NÃO inclui os impostos de importação`
      : null,
    rating: item.rating || null,
    sales: item.sales || null,
    couponLines: item.coupon ? [item.coupon] : [],
    rawText: `${item.title}\nDe: ${formatCurrency(originalPrice)}\nPor: ${formatCurrency(currentPrice)}\n${item.permalink}`,
    sourceGroup: item.sourceGroup || 'Mercado Livre (ofertas do dia)',
    receivedAt: new Date().toISOString(),
    discountPercent,
  };
}

function loadSeen() {
  try {
    if (!fs.existsSync(SEEN_FILE)) return;
    const data = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'));
    if (!Array.isArray(data)) return;
    seen = new Map(data.filter((entry) => Array.isArray(entry) && entry.length === 2));
  } catch (error) {
    logger.warn('[Mercado Livre] Não foi possível carregar ofertas já enviadas:', error.message);
  }
}

function saveSeen() {
  try {
    const entries = [...seen.entries()].slice(-MAX_SEEN_ITEMS);
    fs.writeFileSync(SEEN_FILE, JSON.stringify(entries), 'utf8');
  } catch (error) {
    logger.warn('[Mercado Livre] Não foi possível salvar ofertas já enviadas:', error.message);
  }
}

function seenKey(promo) {
  return `${promo.id}:${promo.currentPrice}`;
}

function selectEligiblePromos(items) {
  return items
    .map(toPromo)
    .filter((promo) => promo && !seen.has(seenKey(promo)))
    .sort((left, right) => right.discountPercent - left.discountPercent);
}

async function fetchOffersPage(category, page) {
  const response = await fetch(buildOffersUrl(category, page), {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`A página de ofertas respondeu ${response.status} ${response.statusText}.`);
  }
  if (response.url.includes('account-verification')) {
    throw new Error('O Mercado Livre pediu login para abrir a página de ofertas.');
  }

  const offers = readOffers(await response.text());
  if (offers === null) {
    throw new Error('A página de ofertas mudou de formato e o bloco de produtos não foi encontrado.');
  }
  return offers;
}

async function fetchCategoryOffers(category) {
  const items = [];
  for (let page = 1; page <= config.mercadoLivrePages; page += 1) {
    const pageItems = await fetchOffersPage(category, page);
    items.push(...pageItems);
    // Página vazia significa fim da lista; adiantar não traria nada novo.
    if (pageItems.length === 0) break;
  }
  return items;
}

async function poll() {
  // Durante o silencio nao coletamos: guardar oferta por nove horas so
  // acumularia fila e entregaria promocao provavelmente expirada.
  if (isQuietHour()) return;
  if (running || !config.mercadoLivrePublicEnabled || config.mercadoLivreCategories.length === 0) return;
  running = true;

  try {
    let added = 0;
    let inspected = 0;
    const categories = config.mercadoLivreCategories;
    const ordered = categories.slice(nextCategoryIndex).concat(categories.slice(0, nextCategoryIndex));
    nextCategoryIndex = (nextCategoryIndex + 1) % categories.length;
    // O mesmo produto aparece em mais de uma categoria; evita repetir no ciclo.
    const enqueuedIds = new Set();

    for (const category of ordered) {
      let items;
      try {
        items = await fetchCategoryOffers(category);
      } catch (error) {
        // Uma categoria com problema não deve derrubar o ciclo inteiro.
        logger.warn(`[Mercado Livre] Falha ao ler a categoria ${category}:`, error.message);
        recordCycle('Mercado Livre', { error: error.message });
        continue;
      }

      inspected += items.length;
      const candidates = keepOnlyRealDeals(
        selectEligiblePromos(items)
          .filter((promo) => !enqueuedIds.has(promo.id))
          .filter((promo) => matchesKeywords(promo.title, config.mercadoLivreKeywords)),
        'mercadolivre'
      ).slice(0, config.mercadoLivreMaxPerCategory);

      for (const promo of candidates) {
        if (added >= config.mercadoLivreMaxResults) break;

        seen.set(seenKey(promo), Date.now());
        enqueuedIds.add(promo.id);
        enqueue(promo);
        added += 1;
        logger.info(`[Mercado Livre] Oferta adicionada (${promo.discountPercent}% OFF): ${promo.title}`);
      }
      if (added >= config.mercadoLivreMaxResults) break;
    }

    if (added > 0) saveSeen();
    recordCycle('Mercado Livre', { read: inspected, added });
    logger.info(`[Mercado Livre] Consulta concluída: ${inspected} oferta(s) lida(s), ${added} nova(s) elegível(is).`);
  } catch (error) {
    logger.warn('[Mercado Livre] Falha na consulta pública:', error.message);
  } finally {
    running = false;
  }
}

function startMercadoLivrePublicSource() {
  if (!config.mercadoLivrePublicEnabled) {
    logger.info('[Mercado Livre] Coletor público desativado (ML_PUBLIC_ENABLED=false).');
    return;
  }
  if (config.mercadoLivreCategories.length === 0) return;
  if (timer) return;

  loadSeen();
  const filtro = config.mercadoLivreKeywords.length > 0
    ? `${config.mercadoLivreKeywords.length} palavra(s)-chave`
    : 'sem filtro de palavra-chave';
  logger.info(`[Mercado Livre] Ofertas do dia: ${config.mercadoLivreCategories.length} categoria(s), ${config.mercadoLivrePages} página(s) cada, ${filtro}, a cada ${config.mercadoLivrePollMinutes} min.`);
  poll();
  timer = setInterval(poll, config.mercadoLivrePollMinutes * 60 * 1000);
}

function stopMercadoLivrePublicSource() {
  if (timer) clearInterval(timer);
  timer = null;
  saveSeen();
}

module.exports = {
  formatCurrency,
  getDiscountPercent,
  normalizeText,
  matchesKeywords,
  buildOffersUrl,
  extractOffersState,
  readOffers,
  toPromo,
  selectEligiblePromos,
  startMercadoLivrePublicSource,
  stopMercadoLivrePublicSource,
};
