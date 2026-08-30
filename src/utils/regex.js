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

const COUPON_PATTERN = /\b(?:cupom|c[oó]digo\s+promocional)\b/i;

// Palavras que aparecem coladas em "cupom" mas não são código nenhum.
// Sem esta lista, "Cupom de R$ 30" devolvia "de" como se fosse cupom.
const NOT_A_COUPON = new Set([
  'de', 'do', 'da', 'no', 'na', 'em', 'com', 'sem', 'para', 'por', 'ate',
  'ou', 'os', 'as', 'um', 'uma', 'the', 'use', 'usar', 'aplique', 'valido',
  'exclusivo', 'primeira', 'compra', 'desconto', 'descontos', 'promocional',
  'cupom', 'cupons', 'codigo', 'off', 'pix', 'frete', 'gratis', 'resgate',
  'resgatar', 'clique', 'link', 'loja', 'app', 'site', 'acima', 'abaixo',
]);

/**
 * Código de cupom é quase sempre alfanumérico e escrito em caixa alta.
 * Exigir esse formato é o que separa "OLI10" de "de" ou "acima".
 */
function looksLikeCouponCode(value) {
  const code = String(value || '').trim();
  if (code.length < 3 || code.length > 30) return false;
  if (NOT_A_COUPON.has(code.toLowerCase())) return false;
  return /^[A-Z0-9][A-Z0-9_-]*$/.test(code);
}

/**
 * Extrai códigos de cupom explicitamente identificados na mensagem.
 * Exemplos: "Cupom: OLI10", "Use o código GAME20",
 * "🏷️ Cupom de R$ 100 acima de R$ 1.000: MONITOR100".
 */
function extractCoupons(text) {
  if (!text) return [];

  const coupons = [];
  const adicionar = (valor) => {
    if (!looksLikeCouponCode(valor)) return;
    if (!coupons.some((existente) => existente.toLowerCase() === String(valor).toLowerCase())) {
      coupons.push(String(valor).trim());
    }
  };

  // 1) Código logo depois do rótulo: "Cupom: OLI10", "código GAME20".
  const aposRotulo = /\b(?:cupom(?:\s+de\s+desconto)?|c[oó]digo(?:\s+promocional)?)\s*(?:é|:|-|=)?\s*[`*_\s]*([a-zA-Z0-9][a-zA-Z0-9_-]{2,30})\b/g;
  let match;
  while ((match = aposRotulo.exec(text)) !== null) adicionar(match[1]);

  // 2) Código no fim de uma linha de cupom, depois de dois pontos. Cobre
  //    "Cupom de R$ 100 acima de R$ 1.000: MONITOR100", em que o rótulo está
  //    longe do código e a regra 1 pararia na primeira palavra.
  for (const line of text.split(/\r?\n/)) {
    if (!COUPON_PATTERN.test(line)) continue;
    const noFim = line.match(/:\s*[`*_]*([a-zA-Z0-9][a-zA-Z0-9_-]{2,30})[`*_]*\s*$/);
    if (noFim) adicionar(noFim[1]);
  }

  return coupons;
}

// Uma linha de preço começa com o rótulo, tolerando emoji e marcação do
// WhatsApp antes dele: "🔥Por: R$499,56", "*De:* ~R$799,00~".
// A âncora no início separa "Por: R$ 10 com cupom" (linha de preço) de
// "Cupom de R$ 30 acima de R$ 200" (linha de cupom de verdade).
const PRICE_LINE_PATTERN = /^[^\p{L}]*(?:de|era|por|agora|pre[cç]o)\b[\s:~*_]*R\$/iu;

function isPriceLine(line) {
  return PRICE_LINE_PATTERN.test(String(line || '').trim());
}

/**
 * Preserva a linha completa do cupom para formatos que não possuem apenas um
 * código simples, como "Cupom de R$ 30 acima de R$ 200".
 * Linhas de preço que apenas mencionam cupom ("Por: R$ 10 com cupom") ficam
 * de fora: elas são preço, não cupom.
 */
function extractCouponLines(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^https?:\/\//i.test(line))
    .filter((line) => COUPON_PATTERN.test(line) && !isPriceLine(line))
    // A fila já prefixa 🎟️ e aplica negrito; manter a decoração da origem
    // renderiza "🎟️ *🎟 *RESGATE o Cupom**" no grupo destino.
    .map((line) => line.replace(/^[^\p{L}\d]+/u, '').replace(/[*_~\s]+$/, ''))
    .filter(Boolean)
    .map((line) => line.slice(0, 240));

  return [...new Set(lines)];
}

function extractPriceDetails(text, prices = extractPrices(text)) {
  if (!text || prices.length === 0) {
    return { originalPrice: null, currentPrice: null };
  }

  // `[\s:~*_]*` depois do rótulo: o preço costuma vir riscado ou em negrito,
  // como "De: ~R$799,00~", e o til impedia o casamento.
  const pricePattern = '(R\\$\\s?\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})?)';
  const originalMatch = text.match(new RegExp(`\\b(?:de|era)\\b[\\s:~*_]*${pricePattern}`, 'i'));
  const currentMatch = text.match(new RegExp(`\\b(?:por|agora|pre[cç]o)\\b[\\s:~*_]*${pricePattern}`, 'i'));

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
      couponLines: [],
      originalPrice: null,
      currentPrice: null,
      title: '',
      rawText: '',
    };
  }

  const urls = extractUrls(text);
  const coupons = extractCoupons(text);
  const couponLines = extractCouponLines(text);
  // Descarta as linhas de cupom antes de ler os preços, mas preserva as que
  // são preço e só citam cupom de passagem. Sem isso, "Por: R$ X com cupom"
  // sumia e o preço anterior, riscado, acabava anunciado como preço atual.
  const textWithoutCouponLines = text.split(/\r?\n/)
    .filter((line) => !COUPON_PATTERN.test(line) || isPriceLine(line))
    .join('\n');
  const prices = extractPrices(textWithoutCouponLines);
  const { originalPrice, currentPrice } = extractPriceDetails(textWithoutCouponLines, prices);

  // Tenta extrair o título: primeira linha que não seja só URL ou preço
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let title = '';

  for (const line of lines) {
    // Pula linhas que são apenas URLs
    const isOnlyUrl = /^https?:\/\/\S+$/.test(line);
    if (!isOnlyUrl && !isPriceLine(line)) {
      // A fila reaplica negrito no título; manter os asteriscos da origem
      // renderiza "**assim**" no grupo destino.
      title = line.replace(/^[*_~\s]+/, '').replace(/[*_~\s]+$/, '');
      break;
    }
  }

  return {
    urls,
    prices,
    coupons,
    couponLines,
    originalPrice,
    currentPrice,
    title,
    rawText: text,
  };
}

module.exports = {
  extractUrls,
  extractPrices,
  extractCoupons,
  extractCouponLines,
  extractPriceDetails,
  extractPromoInfo,
};
