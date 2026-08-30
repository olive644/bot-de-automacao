const assert = require('node:assert/strict');
const {
  formatCurrency,
  getDiscountPercent,
  toPromo,
  selectEligiblePromos,
  buildWebSearchUrl,
  unwrapManagedPayload,
  canonicalizeMercadoLivreUrl,
  normalizeManagedResults,
} = require('./src/services/mercadolivre-public');

assert.equal(formatCurrency(52.28), 'R$ 52,28');
assert.equal(getDiscountPercent(100, 75), 25);
assert.equal(getDiscountPercent(100, 100), 0);
assert.equal(buildWebSearchUrl('Placa de vídeo'), 'https://lista.mercadolivre.com.br/placa-de-video');

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

const sorted = selectEligiblePromos([
  { id: 'MLB1', title: 'Desconto menor', price: 80, original_price: 100, permalink: 'https://example.com/1' },
  { id: 'MLB2', title: 'Desconto maior', price: 50, original_price: 100, permalink: 'https://example.com/2' },
]);
assert.equal(sorted[0].id, 'MLB2');

assert.deepEqual(unwrapManagedPayload({ status: 'success', data: '{"results":[]}' }), { results: [] });
assert.equal(
  canonicalizeMercadoLivreUrl('https://www.mercadolivre.com.br/produto/p/MLB123456?wid=MLB999#tracking'),
  'https://www.mercadolivre.com.br/produto/p/MLB123456'
);
assert.equal(canonicalizeMercadoLivreUrl('https://click1.mercadolivre.com.br/anuncio'), null);

const managed = normalizeManagedResults({
  status: 'success',
  data: JSON.stringify({
    results: [
      {
        title: 'SSD NVMe em promoção',
        url: 'https://www.mercadolivre.com.br/ssd-nvme/p/MLB123456?wid=MLB654321#tracking',
        price: 199.9,
        original_price: 299.9,
      },
      {
        title: 'Anúncio patrocinado sem link original',
        url: 'https://click1.mercadolivre.com.br/rastreio',
        price: 10,
        original_price: 20,
      },
    ],
  }),
});
assert.equal(managed.length, 1);
assert.equal(managed[0].id, 'MLB123456');
assert.equal(managed[0].sourceGroup, 'Mercado Livre (busca gerenciada)');

console.log('Coletor público do Mercado Livre: filtros e preços válidos.');
