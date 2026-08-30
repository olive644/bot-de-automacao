// ============================================
// Coletor público do Mercado Livre
// Pesquisa itens com desconto real, sem OAuth.
// ============================================

const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const { enqueue } = require('./queue');

const SEARCH_URL = 'https://api.mercadolibre.com/sites/MLB/search';
const SEEN_FILE = path.resolve(__dirname, '../../.mercadolivre_seen.json');
const MAX_SEEN_ITEMS = 5000;

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
    media: null,
    rawText: `${item.title}\nDe: ${formatCurrency(originalPrice)}\nPor: ${formatCurrency(currentPrice)}\n${item.permalink}`,
    sourceGroup: 'Mercado Livre (catálogo público)',
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

async function search(query) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('q', query);
  // A API não ordena por desconto. Avaliamos uma amostra maior para encontrar
  // promoções com preço anterior, sem fazer uma chamada por produto.
  url.searchParams.set('limit', '50');

  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'Oli-Bot/1.0' },
  });
  if (!response.ok) {
    throw new Error(`API respondeu ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

async function poll() {
  if (running || !config.mercadoLivrePublicEnabled || config.mercadoLivreSearches.length === 0) return;
  running = true;

  try {
    let added = 0;
    const searches = config.mercadoLivreSearches;
    const orderedSearches = searches.slice(nextSearchIndex).concat(searches.slice(0, nextSearchIndex));
    nextSearchIndex = (nextSearchIndex + 1) % searches.length;

    for (const query of orderedSearches) {
      const items = await search(query);
      const candidates = selectEligiblePromos(items).slice(0, config.mercadoLivreMaxPerSearch);
      for (const promo of candidates) {
        if (added >= config.mercadoLivreMaxResults) break;

        seen.set(seenKey(promo), Date.now());
        enqueue(promo);
        added += 1;
        logger.info(`[Mercado Livre] Oferta adicionada (${promo.discountPercent}% OFF): ${promo.title}`);
      }
      if (added >= config.mercadoLivreMaxResults) break;
    }
    if (added > 0) saveSeen();
    logger.info(`[Mercado Livre] Consulta concluída: ${added} nova(s) oferta(s) elegível(is).`);
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
  if (config.mercadoLivreSearches.length === 0) return;
  if (timer) return;

  loadSeen();
  logger.info(`[Mercado Livre] Coletor público ativo: ${config.mercadoLivreSearches.length} busca(s), a cada ${config.mercadoLivrePollMinutes} min.`);
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
  toPromo,
  selectEligiblePromos,
  startMercadoLivrePublicSource,
  stopMercadoLivrePublicSource,
};
