// ============================================
// Utilitário de Regex para extração de dados
// Captura URLs, preços e títulos das promoções
// ============================================

/**
 * Extrai todas as URLs de um texto.
 * Captura links http, https e variações com www.
 *
 * @param {string} text - Texto da mensagem
 * @returns {string[]} - Array de URLs encontradas
 */
function extractUrls(text) {
  if (!text) return [];

  // Regex robusta para URLs — captura http(s) e www
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const matches = text.match(urlRegex);

  return matches || [];
}

/**
 * Extrai informações de preço no formato brasileiro (R$ X.XXX,XX).
 *
 * @param {string} text - Texto da mensagem
 * @returns {string[]} - Array de preços encontrados (ex: ["R$ 1.299,90"])
 */
function extractPrices(text) {
  if (!text) return [];

  // Captura: R$ 99,90 | R$ 1.299,90 | R$99 | R$ 10.000,00
  const priceRegex = /R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?/gi;
  const matches = text.match(priceRegex);

  return matches || [];
}

/**
 * Extrai códigos de cupom explicitamente identificados na mensagem.
 * Exemplos: "Cupom: OLI10", "Use o código GAME20".
 */
function extractCoupons(text) {
  if (!text) return [];

  const couponRegex = /\b(?:cupom(?:\s+de\s+desconto)?|c[oó]digo(?:\s+promocional)?)\s*(?:é|:|-|=)?\s*[`*_\s]*([a-z0-9][a-z0-9_-]{2,30})\b/gi;
  const coupons = [];
  let match;
  while ((match = couponRegex.exec(text)) !== null) {
    const coupon = match[1];
    if (!coupons.some((value) => value.toLowerCase() === coupon.toLowerCase())) {
      coupons.push(coupon);
    }
  }
  return coupons;
}

function extractPriceDetails(text, prices = extractPrices(text)) {
  if (!text || prices.length === 0) {
    return { originalPrice: null, currentPrice: null };
  }

  const pricePattern = '(R\\$\\s?\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})?)';
  const originalMatch = text.match(new RegExp(`\\b(?:de|era)\\s*:?\\s*${pricePattern}`, 'i'));
  const currentMatch = text.match(new RegExp(`\\b(?:por|agora|pre[cç]o)\\s*:?\\s*${pricePattern}`, 'i'));

  const originalPrice = originalMatch?.[1] || (prices.length > 1 ? prices[0] : null);
  const currentPrice = currentMatch?.[1] || prices[prices.length - 1];

  return { originalPrice, currentPrice };
}

/**
 * Extrai informações completas da promoção:
 * - URLs do produto
 * - Preços encontrados
 * - Título (primeira linha não-vazia sem URL/preço)
 *
 * @param {string} text - Texto completo da mensagem
 * @returns {{ urls: string[], prices: string[], coupons: string[], originalPrice: string|null, currentPrice: string|null, title: string, rawText: string }}
 */
function extractPromoInfo(text) {
  if (!text) {
    return {
      urls: [],
      prices: [],
      coupons: [],
      originalPrice: null,
      currentPrice: null,
      title: '',
      rawText: '',
    };
  }

  const urls = extractUrls(text);
  const prices = extractPrices(text);
  const coupons = extractCoupons(text);
  const { originalPrice, currentPrice } = extractPriceDetails(text, prices);

  // Tenta extrair o título: primeira linha que não seja só URL ou espaço
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let title = '';

  for (const line of lines) {
    // Pula linhas que são apenas URLs
    const isOnlyUrl = /^https?:\/\/\S+$/.test(line);
    const isPriceLine = /^(?:de|era|por|agora|pre[cç]o)\s*:/i.test(line);
    if (!isOnlyUrl && !isPriceLine) {
      title = line;
      break;
    }
  }

  return {
    urls,
    prices,
    coupons,
    originalPrice,
    currentPrice,
    title,
    rawText: text,
  };
}

module.exports = { extractUrls, extractPrices, extractCoupons, extractPriceDetails, extractPromoInfo };
