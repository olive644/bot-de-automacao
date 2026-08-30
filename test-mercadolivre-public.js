const assert = require('node:assert/strict');
const { formatCurrency, getDiscountPercent, toPromo } = require('./src/services/mercadolivre-public');

assert.equal(formatCurrency(52.28), 'R$ 52,28');
assert.equal(getDiscountPercent(100, 75), 25);
assert.equal(getDiscountPercent(100, 100), 0);

const promo = toPromo({
  id: 'MLB123',
  title: 'Jogo em promoção',
  price: 79.9,
  original_price: 129.9,
  permalink: 'https://www.mercadolivre.com.br/jogo-em-promocao/p/MLB123',
});
assert.equal(promo.id, 'MLB123');
assert.equal(promo.originalPrice, 'R$ 129,90');
assert.equal(promo.currentPrice, 'R$ 79,90');
assert.equal(promo.discountPercent, 38);
assert.equal(toPromo({ id: 'MLB999', title: 'Sem desconto', price: 100, original_price: null, permalink: 'https://example.com' }), null);

console.log('Coletor público do Mercado Livre: filtros e preços válidos.');
