// ============================================
// Coletor AliExpress
// Lê a busca pública de pt.aliexpress.com, que embute o resultado em JSON
// na própria página. Sem chave, sem conta de afiliado e sem navegador.
//
// Diferente do Mercado Livre, aqui a busca por palavra continua aberta:
// cada termo do .env vira uma consulta de verdade.
// ============================================

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { isQuietHour } = require('../utils/horario');
const logger = require('../utils/logger');
const { enqueue } = require('./queue');
const { keepOnlyRealDeals } = require('./price-history');
const { recordCycle } = require('./health');

const SEARCH_URL = 'https://pt.aliexpress.com/w/wholesale-{slug}.html';
const ITEM_URL = 'https://pt.aliexpress.com/item/{id}.html';
// A página traz o estado em `window._dida_config_._init_data_= { data: {...} }`,
// logo depois de um comentário marcador.
const STATE_MARKER = 'init-data-start';
const SEEN_FILE = path.resolve(__dirname, '../../.aliexpress_seen.json');
const MAX_SEEN_ITEMS = 5000;
const REQUEST_TIMEOUT_MS = 30000;
// Intervalo entre uma busca e a seguinte, para não bater em rajada.
const DELAY_BETWEEN_SEARCHES_MS = 2000;
const REQUEST_HEADERS = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

let timer = null;
let running = false;
let seen = new Map();
let nextSearchIndex = 0;

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

function buildSearchUrl(query) {
  const slug = String(query || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return SEARCH_URL.replace('{slug}', slug);
}

/**
 * Recorta o objeto JSON embutido na página.
 * A chave externa vem sem aspas (`{ data: {...} }`), então JSON.parse não
 * serve no texto inteiro: casamos as chaves a partir do primeiro `{` depois
 * de `data:`, respeitando aspas e escapes.
 */
function extractSearchState(html) {
  const marker = html.indexOf(STATE_MARKER);
  if (marker === -1) return null;
  const assignment = html.indexOf('_init_data_=', marker);
  if (assignment === -1) return null;
  const dataKey = html.indexOf('data:', assignment);
  if (dataKey === -1) return null;
  const start = html.indexOf('{', dataKey);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i += 1) {
    const char = html[i];
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch (error) {
          return null;
        }
      }
    }
  }
  return null;
}

function readPrice(price) {
  if (!price || price.currencyCode !== 'BRL') return null;
  const value = Number(price.minPrice);
  return Number.isFinite(value) ? value : null;
}

/**
 * Converte o card da busca no mesmo formato que os outros coletores usam.
 * Item fora de BRL é descartado: o grupo é brasileiro e anunciar preço em
 * outra moeda seria enganoso.
 */
function toOfferItem(entry) {
  const id = entry?.productId || entry?.redirectedId;
  const title = entry?.title?.displayTitle;
  const prices = entry?.prices;
  if (!id || !title || !prices) return null;

  const original = readPrice(prices.originalPrice);
  const current = readPrice(prices.salePrice);
  if (original === null || current === null) return null;

  // O selo local_flag marca produto que sai de armazém no Brasil. Sem ele,
  // o pedido vem do exterior e pode pegar imposto na entrada.
  const selos = (entry?.sellingPoints || []).map((s) => String(s?.source || ''));
  const nacional = selos.includes('local_flag');

  return {
    id: String(id),
    title: String(title).trim(),
    permalink: ITEM_URL.replace('{id}', String(id)),
    price: current,
    original_price: original,
    // imgUrl vem sem protocolo, no formato "//host/caminho.jpg".
    imageUrl: entry?.image?.imgUrl || null,
    rating: entry?.evaluation?.starRating ? String(entry.evaluation.starRating) : null,
    sales: entry?.trade?.tradeDesc ? String(entry.trade.tradeDesc).replace(/\s+/g, ' ').trim() : null,
    origin: nacional ? 'nacional' : 'internacional',
    taxRate: prices.taxRate !== undefined ? String(prices.taxRate) : null,
    // Anúncio que lista várias capacidades ou tamanhos no título: o preço
    // do feed é o da versão mais barata, não o de qualquer uma.
    multiVariant: hasMultipleVariants(String(title)),
  };
}

// Título tipo "SSD 128GB 256GB 512GB 1TB" ou "DDR4 8GB 16GB 32GB": duas ou
// mais capacidades enfileiradas indicam anúncio com versões diferentes.
const CAPACIDADE = /\b\d+\s?(?:gb|tb|mb)\b/gi;

function hasMultipleVariants(title) {
  const capacidades = String(title).match(CAPACIDADE) || [];
  const distintas = new Set(capacidades.map((c) => c.toLowerCase().replace(/\s+/g, '')));
  return distintas.size >= 2;
}

function readOffers(html) {
  const state = extractSearchState(html);
  const list = state?.data?.root?.fields?.mods?.itemList?.content;
  if (!Array.isArray(list)) return null;
  return list.map(toOfferItem).filter(Boolean);
}

function toPromo(item) {
  const originalPrice = Number(item.original_price);
  const currentPrice = Number(item.price);
  const discountPercent = getDiscountPercent(originalPrice, currentPrice);

  if (!item.id || !item.title || !item.permalink || discountPercent < config.aliexpressMinDiscount) {
    return null;
  }

  // Anúncio que cobre várias capacidades no mesmo título traz o preço da
  // mais barata. Um SSD "128GB 256GB 512GB 1TB 2TB" anunciado por R$ 201,97
  // tem a versão de 2TB a R$ 1.533,86 — sete vezes mais. Nem o aviso
  // resolvia: quem lê o valor em destaque não vai conferir o anúncio.
  // Medido, descartar isso tira 26% das ofertas e ainda sobram 145
  // candidatas por ciclo, para 2 publicadas por hora.
  if (config.aliexpressSkipMultiVariant && item.multiVariant) {
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
    store: 'AliExpress',
    // O card da busca não expõe o nome da loja; melhor omitir do que supor.
    seller: null,
    origin: item.origin || null,
    taxNote: item.origin === 'nacional'
      ? 'Sai de estoque no Brasil, sem imposto de importação'
      : 'Importado, o valor acima NÃO inclui os impostos de importação',
    variants: item.multiVariant ? 'O anúncio tem versões com preços diferentes' : null,
    priceFromVariant: !!item.multiVariant,
    rating: item.rating || null,
    sales: item.sales || null,
    rawText: `${item.title}\nDe: ${formatCurrency(originalPrice)}\nPor: ${formatCurrency(currentPrice)}\n${item.permalink}`,
    sourceGroup: 'AliExpress',
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
    logger.warn('[AliExpress] Não foi possível carregar ofertas já enviadas:', error.message);
  }
}

function saveSeen() {
  try {
    const entries = [...seen.entries()].slice(-MAX_SEEN_ITEMS);
    fs.writeFileSync(SEEN_FILE, JSON.stringify(entries), 'utf8');
  } catch (error) {
    logger.warn('[AliExpress] Não foi possível salvar ofertas já enviadas:', error.message);
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

async function fetchSearch(query) {
  const response = await fetch(buildSearchUrl(query), {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`A busca respondeu ${response.status} ${response.statusText}.`);
  }
  const html = await response.text();
  if (/\/(?:_____tmd_____|punish)/.test(response.url) || html.includes('punish')) {
    throw new Error('O AliExpress pediu verificação anti-robô nesta consulta.');
  }

  const offers = readOffers(html);
  if (offers === null) {
    throw new Error('A página de busca mudou de formato e a lista de produtos não foi encontrada.');
  }
  return offers;
}

async function poll() {
  // Durante o silencio nao coletamos: guardar oferta por nove horas so
  // acumularia fila e entregaria promocao provavelmente expirada.
  if (isQuietHour()) return;
  if (running || !config.aliexpressEnabled || config.aliexpressSearches.length === 0) return;
  running = true;

  try {
    let added = 0;
    let inspected = 0;
    const searches = config.aliexpressSearches;
    const ordered = searches.slice(nextSearchIndex).concat(searches.slice(0, nextSearchIndex));
    nextSearchIndex = (nextSearchIndex + 1) % searches.length;
    // O mesmo produto aparece em mais de um termo; evita repetir no ciclo.
    const enqueuedIds = new Set();

    for (const [index, query] of ordered.entries()) {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_SEARCHES_MS));

      let items;
      try {
        items = await fetchSearch(query);
      } catch (error) {
        // Um termo com problema não pode derrubar o ciclo inteiro.
        logger.warn(`[AliExpress] Falha na busca "${query}":`, error.message);
        recordCycle('AliExpress', { error: error.message });
        continue;
      }

      inspected += items.length;
      const candidates = keepOnlyRealDeals(
        selectEligiblePromos(items).filter((promo) => !enqueuedIds.has(promo.id)),
        'aliexpress'
      ).slice(0, config.aliexpressMaxPerSearch);

      for (const promo of candidates) {
        if (added >= config.aliexpressMaxResults) break;

        seen.set(seenKey(promo), Date.now());
        enqueuedIds.add(promo.id);
        enqueue(promo);
        added += 1;
        logger.info(`[AliExpress] Oferta adicionada (${promo.discountPercent}% OFF): ${promo.title}`);
      }
      if (added >= config.aliexpressMaxResults) break;
    }

    if (added > 0) saveSeen();
    recordCycle('AliExpress', { read: inspected, added });
    logger.info(`[AliExpress] Consulta concluída: ${inspected} produto(s) lido(s), ${added} nova(s) oferta(s) elegível(is).`);
  } catch (error) {
    logger.warn('[AliExpress] Falha na consulta:', error.message);
  } finally {
    running = false;
  }
}

function startAliexpressSource() {
  if (!config.aliexpressEnabled) {
    logger.info('[AliExpress] Coletor desativado (ALIEXPRESS_ENABLED=false).');
    return;
  }
  if (config.aliexpressSearches.length === 0) {
    logger.warn('[AliExpress] ALIEXPRESS_ENABLED está ativo, mas ALIEXPRESS_SEARCHES está vazio.');
    return;
  }
  if (timer) return;

  loadSeen();
  logger.info(`[AliExpress] Coletor ativo: ${config.aliexpressSearches.length} busca(s), desconto a partir de ${config.aliexpressMinDiscount}%, a cada ${config.aliexpressPollMinutes} min.`);
  poll();
  timer = setInterval(poll, config.aliexpressPollMinutes * 60 * 1000);
}

function stopAliexpressSource() {
  if (timer) clearInterval(timer);
  timer = null;
  saveSeen();
}

module.exports = {
  formatCurrency,
  getDiscountPercent,
  buildSearchUrl,
  extractSearchState,
  readOffers,
  toOfferItem,
  toPromo,
  selectEligiblePromos,
  startAliexpressSource,
  stopAliexpressSource,
};
