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
const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const SEEN_FILE = path.resolve(__dirname, '../../.mercadolivre_seen.json');
const MAX_SEEN_ITEMS = 5000;

let timer = null;
let running = false;
let seen = new Map();
let nextSearchIndex = 0;
let applicationToken = null;
let applicationTokenExpiresAt = 0;
let policyBlocked = false;
let webBrowser = null;
let webPage = null;

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

  let response = await requestSearch(url);
  if ((response.status === 401 || response.status === 403) && config.mercadoLivreClientId && config.mercadoLivreClientSecret) {
    logger.info('[Mercado Livre] Catálogo público bloqueado; tentando credencial da aplicação.');
    const token = await getApplicationToken();
    response = await requestSearch(url, token);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const detail = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    if ((response.status === 401 || response.status === 403) && config.mercadoLivreWebFallbackEnabled) {
      logger.info(`[Mercado Livre] API indisponível; usando página pública para "${query}".`);
      return searchWebPage(query);
    }
    const error = new Error(`API respondeu ${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`);
    if (response.status === 403 && /PA_UNAUTHORIZED_RESULT_FROM_POLICIES|blocked_by/i.test(body)) {
      error.code = 'ML_POLICY_UNAUTHORIZED';
    }
    throw error;
  }

  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

function buildWebSearchUrl(query) {
  const slug = query.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `https://lista.mercadolivre.com.br/${slug}`;
}

async function getWebPage() {
  if (webPage && !webPage.isClosed()) return webPage;
  const puppeteer = require('puppeteer');
  webBrowser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  webPage = await webBrowser.newPage();
  await webPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await webPage.setViewport({ width: 1365, height: 900 });
  return webPage;
}

async function searchWebPage(query) {
  const page = await getWebPage();
  await page.goto(buildWebSearchUrl(query), { waitUntil: 'domcontentloaded', timeout: 45000 });

  const items = await page.evaluate(() => {
    function amount(root) {
      if (!root) return null;
      const fraction = root.querySelector('.andes-money-amount__fraction')?.textContent || '';
      const cents = root.querySelector('.andes-money-amount__cents')?.textContent || '00';
      const integer = fraction.replace(/\D/g, '');
      if (!integer) return null;
      return Number(`${integer}.${cents.replace(/\D/g, '').padEnd(2, '0').slice(0, 2)}`);
    }

    const cards = [...document.querySelectorAll('li.ui-search-layout__item, .poly-card, .ui-search-result')];
    return cards.slice(0, 50).map((card, index) => {
      const link = card.querySelector('a.poly-component__title, a.ui-search-link, a[href*="mercadolivre.com.br/MLB-"]');
      const title = link?.textContent?.trim() || card.querySelector('h2')?.textContent?.trim();
      const currentRoot = card.querySelector('.poly-price__current .andes-money-amount, .ui-search-price__second-line .andes-money-amount, .andes-money-amount:not(.andes-money-amount--previous)');
      const previousRoot = card.querySelector('.andes-money-amount--previous, .ui-search-price__original-value .andes-money-amount');
      const permalink = link?.href || '';
      const match = permalink.match(/MLB-?(\d+)/i);
      return {
        id: match ? `MLB${match[1]}` : `web-${index}-${permalink}`,
        title,
        permalink,
        price: amount(currentRoot),
        original_price: amount(previousRoot),
      };
    }).filter((item) => item.title && item.permalink && item.price);
  });

  if (items.length === 0) {
    throw new Error('A página pública não retornou produtos; pode haver bloqueio ou CAPTCHA.');
  }
  return items;
}

async function requestSearch(url, token = null) {
  const headers = {
    accept: 'application/json',
    'user-agent': 'Oli-Bot/1.0',
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(url, { headers });
}

async function getApplicationToken() {
  if (applicationToken && applicationTokenExpiresAt - Date.now() > 5 * 60 * 1000) {
    return applicationToken;
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.mercadoLivreClientId,
      client_secret: config.mercadoLivreClientSecret,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(`Não foi possível obter credencial da aplicação (${response.status}).`);
  }

  applicationToken = payload.access_token;
  applicationTokenExpiresAt = Date.now() + (Number(payload.expires_in) || 6 * 60 * 60) * 1000;
  return applicationToken;
}

async function poll() {
  if (running || policyBlocked || !config.mercadoLivrePublicEnabled || config.mercadoLivreSearches.length === 0) return;
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
    if (error.code === 'ML_POLICY_UNAUTHORIZED') {
      policyBlocked = true;
      if (timer) clearInterval(timer);
      timer = null;
      logger.warn('[Mercado Livre] Aplicação sem política para pesquisar produtos. Coletor desativado nesta execução; grupos-fonte e ITAD continuam ativos.');
    } else {
      logger.warn('[Mercado Livre] Falha na consulta pública:', error.message);
    }
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
  if (webBrowser) webBrowser.close().catch(() => {});
  webBrowser = null;
  webPage = null;
}

module.exports = {
  formatCurrency,
  getDiscountPercent,
  toPromo,
  selectEligiblePromos,
  getApplicationToken,
  buildWebSearchUrl,
  startMercadoLivrePublicSource,
  stopMercadoLivrePublicSource,
};
