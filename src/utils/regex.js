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
 * Extrai informações completas da promoção:
 * - URLs do produto
 * - Preços encontrados
 * - Título (primeira linha não-vazia sem URL/preço)
 *
 * @param {string} text - Texto completo da mensagem
 * @returns {{ urls: string[], prices: string[], title: string, rawText: string }}
 */
function extractPromoInfo(text) {
  if (!text) {
    return { urls: [], prices: [], title: '', rawText: '' };
  }

  const urls = extractUrls(text);
  const prices = extractPrices(text);

  // Tenta extrair o título: primeira linha que não seja só URL ou espaço
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let title = '';

  for (const line of lines) {
    // Pula linhas que são apenas URLs
    const isOnlyUrl = /^https?:\/\/\S+$/.test(line);
    if (!isOnlyUrl) {
      title = line;
      break;
    }
  }

  return {
    urls,
    prices,
    title,
    rawText: text,
  };
}

module.exports = { extractUrls, extractPrices, extractPromoInfo };
