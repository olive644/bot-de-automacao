// ============================================
// "Traga somente promoções."
//
// As fontes de texto livre — grupos do WhatsApp e canais do Telegram —
// publicam de tudo: recado, enquete, conversa e, no meio, oferta. Até aqui
// bastava ter um link para virar promoção, e por isso mensagens como
// "É acho que não vai ter cupom no Choice outra vez...." chegavam ao grupo
// de destino como se fossem oferta.
//
// Os coletores não passam por esta checagem: eles já vêm de um feed de
// ofertas, com preço e desconto conferidos na origem.
// ============================================

const config = require('../config');

// Palavras que anunciam oferta mesmo sem valor explícito na mensagem.
const SINAIS_DE_OFERTA = /\b(?:off|desconto|promo(?:c|ç)[aã]o|oferta|cupom|c[oó]digo\s+promocional|frete\s+gr[aá]tis|menor\s+pre[cç]o|baixou|liquida(?:c|ç)[aã]o|black\s*friday)\b/i;

/**
 * Uma promoção precisa dizer quanto custa ou o que dá de vantagem.
 * Só link e texto solto não basta.
 */
function looksLikeOffer(promo) {
  if (!config.onlyRealOffers) return true;

  const temPreco = !!promo?.currentPrice
    || (Array.isArray(promo?.prices) && promo.prices.length > 0);
  if (temPreco) return true;

  const temCupom = (Array.isArray(promo?.coupons) && promo.coupons.length > 0)
    || (Array.isArray(promo?.couponLines) && promo.couponLines.length > 0);
  if (temCupom) return true;

  // Sem preço e sem cupom, ainda aceitamos quando o texto anuncia oferta de
  // forma explícita — "50% OFF", "frete grátis". É o caso de post que manda
  // direto para a loja sem repetir o valor.
  return SINAIS_DE_OFERTA.test(String(promo?.rawText || promo?.title || ''));
}

module.exports = { looksLikeOffer, SINAIS_DE_OFERTA };
