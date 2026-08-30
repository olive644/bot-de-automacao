const assert = require('node:assert/strict');
const { formatMessage, buildHeader } = require('./src/services/queue');
const { lojaPelaUrl, lojaDaPromocao } = require('./src/utils/plataforma');
const { looksLikeOffer } = require('./src/utils/promocao');

// ---------- identificação da loja pelo link ----------
assert.equal(lojaPelaUrl('https://s.shopee.com.br/7Aa9TOkP8y'), 'Shopee');
assert.equal(lojaPelaUrl('https://meli.la/1t7zo3c'), 'Mercado Livre');
assert.equal(lojaPelaUrl('https://link.amazon/B07WoGY1V'), 'Amazon');
assert.equal(lojaPelaUrl('https://pt.aliexpress.com/item/1.html'), 'AliExpress');
assert.equal(lojaPelaUrl('https://www.pichau.com.br/teclado'), 'Pichau');
assert.equal(lojaPelaUrl('https://www.kabum.com.br/produto/1'), 'KaBuM');
// Domínio desconhecido não vira nome inventado: afirmar uma origem que
// ninguém verificou é pior do que omitir.
assert.equal(lojaPelaUrl('https://loja-qualquer.com.br/x'), null);
assert.equal(lojaPelaUrl('nao-e-url'), null);

assert.equal(lojaDaPromocao({ urls: ['https://exemplo.com/x', 'https://s.shopee.com.br/y'] }), 'Shopee');
assert.equal(lojaDaPromocao({ urls: [] }), null);

// ---------- cabeçalho ----------
assert.equal(
  buildHeader({ store: 'Shopee', seller: 'Pichau', origin: 'nacional' }),
  '🇧🇷  *#Shopee / Pichau*'
);
assert.equal(
  buildHeader({ store: 'AliExpress', origin: 'internacional' }),
  '🌎  *#AliExpress*'
);
// Sem origem conhecida, nenhuma bandeira.
assert.equal(buildHeader({ store: 'Steam' }), '*#Steam*');
assert.equal(buildHeader({ urls: [] }), '✨ *OFERTA ENCONTRADA*');

// ---------- mensagem completa ----------
const mensagem = formatMessage({
  store: 'Mercado Livre',
  seller: 'TNT Info',
  origin: 'nacional',
  title: 'Processador AMD Ryzen 7 5700G',
  originalPrice: 'R$ 1.699,00',
  currentPrice: 'R$ 975,19',
  discountPercent: 43,
  installments: '10x R$ 106,00 sem juros',
  shipping: 'Frete grátis',
  rating: '4.9',
  sales: 'Mais de 10mil vendidos',
  coupons: ['BAIXOU10'],
  urls: ['https://www.mercadolivre.com.br/p/MLB18441624'],
});

assert.match(mensagem, /🇧🇷 {2}\*#Mercado Livre \/ TNT Info\*/);
assert.match(mensagem, /\*Processador AMD Ryzen 7 5700G\*/);
assert.match(mensagem, /~De: R\$ 1\.699,00~/);
assert.match(mensagem, /\*Valor: R\$ 975,19\*/);
assert.match(mensagem, /43% de desconto/);
assert.match(mensagem, /🚚 Frete grátis/);
assert.match(mensagem, /⭐ 4\.9/);
assert.match(mensagem, /\*CUPOM:\* `BAIXOU10`/);
assert.match(mensagem, /Link do produto/);
// Nenhuma sequência de três quebras: bloco vazio não pode deixar buraco.
assert.doesNotMatch(mensagem, /\n{3}/);

// ---------- anúncio com várias versões ----------
// O preço do feed é o da versão mais barata. Anunciar "R$ 703,85" seco num
// anúncio de SSD de 512GB a 2TB faria esperar o de 2TB por esse preço.
const multi = formatMessage({
  store: 'AliExpress',
  origin: 'internacional',
  title: 'SSD Nvme M2 512GB 1TB 2TB',
  currentPrice: 'R$ 703,85',
  priceFromVariant: true,
  variants: 'O anúncio tem versões com preços diferentes',
  taxNote: 'Importado; pode ter imposto na entrada',
  urls: ['https://pt.aliexpress.com/item/1.html'],
});
assert.match(multi, /\*A partir de: R\$ 703,85\*/);
assert.match(multi, /⚠️ O anúncio tem versões com preços diferentes/);
assert.match(multi, /🧾 Importado; pode ter imposto na entrada/);

// Sem variações, o rótulo volta a ser "Valor".
const simples = formatMessage({ store: 'Shopee', currentPrice: 'R$ 71,99', urls: ['https://s.shopee.com.br/x'] });
assert.match(simples, /\*Valor: R\$ 71,99\*/);
assert.doesNotMatch(simples, /A partir de/);

// ---------- somente promoções ----------
// Com preço, com cupom ou com sinal explícito de oferta: passa.
assert.equal(looksLikeOffer({ currentPrice: 'R$ 10,00' }), true);
assert.equal(looksLikeOffer({ prices: ['R$ 10,00'] }), true);
assert.equal(looksLikeOffer({ coupons: ['ABC10'] }), true);
assert.equal(looksLikeOffer({ couponLines: ['Cupom de R$ 30'] }), true);
assert.equal(looksLikeOffer({ rawText: 'Placa de vídeo com 50% OFF, corre' }), true);
assert.equal(looksLikeOffer({ rawText: 'Aproveite o frete grátis de hoje' }), true);

// Conversa de canal com link não é oferta — era isso que chegava ao grupo
// como se fosse promoção.
assert.equal(looksLikeOffer({ rawText: 'É acho que não vai ter no Choice outra vez.... veja https://x.com' }), false);
assert.equal(looksLikeOffer({ rawText: 'Bom dia pessoal https://exemplo.com' }), false);
assert.equal(looksLikeOffer({}), false);

console.log('Mensagem detalhada: loja, cabeçalho, preço por versão e filtro de oferta válidos.');
