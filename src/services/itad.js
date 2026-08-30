// ============================================
// Coletor IsThereAnyDeal (ITAD)
// Promoções de jogos de PC com preço e loja reais.
// ============================================

const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const { enqueue } = require('./queue');
const { keepOnlyRealDeals } = require('./price-history');
const { recordCycle } = require('./health');

const DEALS_URL = 'https://api.isthereanydeal.com/deals/v2';
const SEEN_FILE = path.resolve(__dirname, '../../.itad_seen.json');
const MAX_SEEN_ITEMS = 5000;
const BLOCKED_SHOP_PATTERN = /\bfanatical\b/i;
const ARABIC_SCRIPT_PATTERN = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u;

let timer = null;
let running = false;
let seen = new Map();

function formatCurrency(value, currency) {
  if (!Number.isFinite(Number(value))) return null;
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(value);
  } catch (_) {
    return `${currency || ''} ${Number(value).toFixed(2)}`.trim();
  }
}

function toPromo(item) {
  const deal = item?.deal || {};
  const price = Number(deal.price?.amount);
  const regular = Number(deal.regular?.amount);
  const cut = Number(deal.cut);
  const url = deal.url;
  const title = item?.title;
  const shopId = Number(deal.shop?.id);
  const shopName = deal.shop?.name || '';

  if (config.itadExcludeArabicTitles && ARABIC_SCRIPT_PATTERN.test(title || '')) {
    return null;
  }

  // O parâmetro `shops` da API nem sempre foi suficiente para impedir lojas
  // indesejadas. A validação local torna a lista do .env obrigatória e também
  // bloqueia Fanatical pelo nome/URL, mesmo se a API retornar dados incorretos.
  if (
    !Number.isInteger(shopId)
    || (config.itadShops.length > 0 && !config.itadShops.includes(shopId))
    || BLOCKED_SHOP_PATTERN.test(shopName)
    || /(?:^|\.)fanatical\.com(?:\/|$)/i.test(String(url))
  ) {
    return null;
  }

  // Os parênteses são necessários: sem eles o `&&` amarra só na primeira
  // condição e o filtro de título valeria mesmo com ITAD_EXCLUDE_BUNDLES=false.
  if (config.itadExcludeBundles
    && ((item?.type && item.type !== 'game')
      || /\b(?:bundle|masterclass|e[- ]?learning|course|curso)\b/i.test(title || ''))) {
    return null;
  }

  if (!item?.id || !title || !url || !Number.isFinite(price) || !Number.isFinite(regular) || regular <= price || cut < config.itadMinDiscount) {
    return null;
  }

  const currency = deal.price?.currency || deal.regular?.currency || 'BRL';
  const shop = shopName;
  const originalPrice = formatCurrency(regular, currency);
  const currentPrice = formatCurrency(price, currency);

  return {
    id: item.id,
    title,
    urls: [url],
    prices: [originalPrice, currentPrice],
    originalPrice,
    currentPrice,
    priceValue: price,
    media: null,
    store: shop || 'IsThereAnyDeal',
    origin: null,
    rating: null,
    sales: null,
    imageUrl: item?.assets?.banner600 || item?.assets?.banner400 || item?.assets?.boxart || null,
    rawText: `${title}\nLoja: ${shop}\nDe: ${originalPrice}\nPor: ${currentPrice}\n${url}`,
    sourceGroup: 'IsThereAnyDeal',
    receivedAt: new Date().toISOString(),
    discountPercent: cut,
    shopId,
    preferredShop: config.itadPrimaryShops.includes(shopId),
  };
}

// Sem `type` no filtro: a API do ITAD responde 500 quando esse campo chega
// como lista, e ignora a forma em texto. A separação entre jogo, DLC e
// pacote é feita localmente em toPromo, pelo campo `type` de cada item.
function buildDealsFilter() {
  const filter = {
    cut: { min: config.itadMinDiscount, max: null },
  };

  if (config.itadMinSteamReviews > 0) {
    filter.steamCount = { min: config.itadMinSteamReviews, max: null };
  }

  return filter;
}

function prioritizeShops(promos) {
  return [
    ...promos.filter((promo) => promo.preferredShop),
    ...promos.filter((promo) => !promo.preferredShop),
  ];
}

function seenKey(promo) {
  return `${promo.id}:${promo.currentPrice}:${promo.urls[0]}`;
}

function loadSeen() {
  try {
    if (!fs.existsSync(SEEN_FILE)) return;
    const data = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'));
    if (Array.isArray(data)) seen = new Map(data.filter((entry) => Array.isArray(entry) && entry.length === 2));
  } catch (error) {
    logger.warn('[ITAD] Não foi possível carregar jogos já enviados:', error.message);
  }
}

function saveSeen() {
  try {
    fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen.entries()].slice(-MAX_SEEN_ITEMS)), 'utf8');
  } catch (error) {
    logger.warn('[ITAD] Não foi possível salvar jogos já enviados:', error.message);
  }
}

async function fetchDeals() {
  const url = new URL(DEALS_URL);
  url.searchParams.set('key', config.itadApiKey);
  url.searchParams.set('country', config.itadCountry);
  // Sem `sort=-cut`: a ordem padrão do ITAD é mais relevante e não traz
  // somente jogos desconhecidos com 95–99% de desconto.
  url.searchParams.set('filter', JSON.stringify(buildDealsFilter()));
  url.searchParams.set('limit', String(Math.min(200, Math.max(50, config.itadMaxResults * 20))));
  if (config.itadShops.length > 0) url.searchParams.set('shops', config.itadShops.join(','));

  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Oli-Bot/1.0' } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `API respondeu ${response.status}`);
  }
  return Array.isArray(payload.list) ? payload.list : Array.isArray(payload) ? payload : [];
}

async function poll() {
  if (running || !config.itadEnabled || !config.itadApiKey) return;
  running = true;
  try {
    const eligiblePromos = (await fetchDeals())
      .map(toPromo)
      .filter((promo) => promo && !seen.has(seenKey(promo)));

    const promos = keepOnlyRealDeals(prioritizeShops(eligiblePromos), 'itad')
      .slice(0, config.itadMaxResults);

    for (const promo of promos) {
      seen.set(seenKey(promo), Date.now());
      enqueue(promo);
      logger.info(`[ITAD] Oferta adicionada (${promo.discountPercent}% OFF): ${promo.title}`);
    }
    if (promos.length > 0) saveSeen();
    recordCycle('ITAD', { read: eligiblePromos.length, added: promos.length });
    logger.info(`[ITAD] Consulta concluída: ${promos.length} novo(s) jogo(s) elegível(is).`);
  } catch (error) {
    recordCycle('ITAD', { error: error.message });
    logger.warn('[ITAD] Falha na consulta de jogos:', error.message);
  } finally {
    running = false;
  }
}

function startItadSource() {
  if (!config.itadEnabled) {
    logger.info('[ITAD] Coletor de jogos desativado (ITAD_ENABLED=false).');
    return;
  }
  if (!config.itadApiKey || timer) return;

  loadSeen();
  logger.info(`[ITAD] Coletor ativo para ${config.itadCountry}; desconto a partir de ${config.itadMinDiscount}%, mínimo de ${config.itadMinSteamReviews} avaliações, lojas ${config.itadShops.join(',')}.`);
  poll();
  timer = setInterval(poll, config.itadPollMinutes * 60 * 1000);
}

function stopItadSource() {
  if (timer) clearInterval(timer);
  timer = null;
  saveSeen();
}

module.exports = {
  formatCurrency,
  toPromo,
  buildDealsFilter,
  prioritizeShops,
  startItadSource,
  stopItadSource,
};
