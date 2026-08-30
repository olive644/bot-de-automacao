const assert = require('node:assert/strict');
const { formatCurrency, toPromo } = require('./src/services/itad');
const { isBlockedPromotion } = require('./src/services/queue');

assert.equal(formatCurrency(19.99, 'BRL'), 'R$ 19,99');
const promo = toPromo({
  id: 'game-id',
  title: 'Jogo de teste',
  deal: {
    shop: { id: 61, name: 'Steam' },
    price: { amount: 19.99, currency: 'BRL' },
    regular: { amount: 79.99, currency: 'BRL' },
    cut: 75,
    url: 'https://store.steampowered.com/app/123',
  },
});
assert.equal(promo.title, 'Jogo de teste — Steam');
assert.equal(promo.originalPrice, 'R$ 79,99');
assert.equal(promo.currentPrice, 'R$ 19,99');
assert.equal(promo.preferredShop, true);
assert.equal(toPromo({ id: 'no-sale', title: 'Sem desconto', deal: { price: { amount: 10 }, regular: { amount: 10 }, cut: 0, url: 'https://example.com' } }), null);
assert.equal(toPromo({ id: 'bundle', title: 'Linux eLearning Bundle', type: 'game', deal: { price: { amount: 1 }, regular: { amount: 100 }, cut: 99, url: 'https://example.com' } }), null);
assert.equal(toPromo({
  id: 'fanatical',
  title: 'Unity Programming Bundle',
  type: 'game',
  deal: {
    shop: { id: 6, name: 'Fanatical' },
    price: { amount: 1, currency: 'BRL' },
    regular: { amount: 100, currency: 'BRL' },
    cut: 99,
    url: 'https://www.fanatical.com/game/teste',
  },
}), null);
assert.equal(isBlockedPromotion({
  title: 'Oferta antiga — Fanatical',
  sourceGroup: 'IsThereAnyDeal',
  urls: ['https://www.fanatical.com/game/teste'],
}), true);
assert.equal(isBlockedPromotion({ title: 'Jogo — Steam', urls: ['https://store.steampowered.com/app/123'] }), false);
assert.equal(toPromo({
  id: 'other-shop',
  title: 'Jogo de outra loja',
  type: 'game',
  deal: {
    shop: { id: 999, name: 'Outra loja' },
    price: { amount: 10, currency: 'BRL' },
    regular: { amount: 100, currency: 'BRL' },
    cut: 90,
    url: 'https://example.com/game',
  },
}), null);

console.log('Coletor ITAD: jogos, lojas e filtros válidos.');
