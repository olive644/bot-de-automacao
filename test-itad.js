const assert = require('node:assert/strict');
const { formatCurrency, toPromo } = require('./src/services/itad');

assert.equal(formatCurrency(19.99, 'BRL'), 'R$ 19,99');
const promo = toPromo({
  id: 'game-id',
  title: 'Jogo de teste',
  deal: {
    shop: { name: 'Steam' },
    price: { amount: 19.99, currency: 'BRL' },
    regular: { amount: 79.99, currency: 'BRL' },
    cut: 75,
    url: 'https://store.steampowered.com/app/123',
  },
});
assert.equal(promo.title, 'Jogo de teste — Steam');
assert.equal(promo.originalPrice, 'R$ 79,99');
assert.equal(promo.currentPrice, 'R$ 19,99');
assert.equal(toPromo({ id: 'no-sale', title: 'Sem desconto', deal: { price: { amount: 10 }, regular: { amount: 10 }, cut: 0, url: 'https://example.com' } }), null);

console.log('Coletor ITAD: jogos, lojas e filtros válidos.');
