// ============================================
// Identifica a loja a partir do link da oferta.
//
// Serve às promoções que chegam dos grupos de origem, onde só existe o
// texto da mensagem: dali o nome da plataforma tem que sair do domínio.
// Os coletores já sabem de onde vieram e informam direto.
// ============================================

// Ordem importa: o primeiro padrão que casar vence. Encurtadores ficam
// junto da loja que representam, porque é o que aparece nos grupos.
const LOJAS = [
  [/(?:^|\.)(?:s\.)?shopee\.com\.br|(?:^|\.)shope\.ee/i, 'Shopee'],
  [/(?:^|\.)mercadolivre\.com\.br|(?:^|\.)meli\.la|(?:^|\.)mercadolibre\./i, 'Mercado Livre'],
  [/(?:^|\.)amazon\.com\.br|(?:^|\.)amzn\.to|(?:^|\.)link\.amazon/i, 'Amazon'],
  [/(?:^|\.)aliexpress\.com|(?:^|\.)s\.click\.aliexpress/i, 'AliExpress'],
  [/(?:^|\.)magazinevoce\.com\.br|(?:^|\.)magazineluiza\.com\.br/i, 'Magalu'],
  [/(?:^|\.)kabum\.com\.br/i, 'KaBuM'],
  [/(?:^|\.)pichau\.com\.br/i, 'Pichau'],
  [/(?:^|\.)terabyteshop\.com\.br/i, 'Terabyte'],
  [/(?:^|\.)casasbahia\.com\.br/i, 'Casas Bahia'],
  [/(?:^|\.)pontofrio\.com\.br/i, 'Ponto'],
  [/(?:^|\.)americanas\.com\.br/i, 'Americanas'],
  [/(?:^|\.)submarino\.com\.br/i, 'Submarino'],
  [/(?:^|\.)carrefour\.com\.br/i, 'Carrefour'],
  [/(?:^|\.)fastshop\.com\.br/i, 'Fast Shop'],
  [/(?:^|\.)nike\.com\.br/i, 'Nike'],
  [/(?:^|\.)centauro\.com\.br/i, 'Centauro'],
  [/(?:^|\.)netshoes\.com\.br/i, 'Netshoes'],
  [/(?:^|\.)steampowered\.com|(?:^|\.)steamcommunity\.com/i, 'Steam'],
  [/(?:^|\.)epicgames\.com/i, 'Epic Games'],
  [/(?:^|\.)gog\.com/i, 'GOG'],
  [/(?:^|\.)nuuvem\.com/i, 'Nuuvem'],
  [/(?:^|\.)instant-gaming\.com/i, 'Instant Gaming'],
  [/(?:^|\.)itad\.link|(?:^|\.)isthereanydeal\.com/i, 'IsThereAnyDeal'],
];

function hostDe(url) {
  try {
    return new URL(String(url)).hostname;
  } catch (_) {
    return '';
  }
}

/**
 * Nome da loja a partir da URL, ou null quando o domínio não é conhecido.
 * Inventar nome seria pior do que omitir: a mensagem afirmaria uma origem
 * que ninguém verificou.
 */
function lojaPelaUrl(url) {
  const host = hostDe(url);
  if (!host) return null;
  const encontrada = LOJAS.find(([padrao]) => padrao.test(host));
  return encontrada ? encontrada[1] : null;
}

/**
 * Percorre os links da promoção e devolve a primeira loja reconhecida.
 */
function lojaDaPromocao(promo) {
  const urls = Array.isArray(promo?.urls) ? promo.urls : [];
  for (const url of urls) {
    const loja = lojaPelaUrl(url);
    if (loja) return loja;
  }
  return null;
}

module.exports = { lojaPelaUrl, lojaDaPromocao, LOJAS };
