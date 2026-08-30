const assert = require('node:assert/strict');
const {
  formatCurrency,
  getDiscountPercent,
  normalizeText,
  matchesKeywords,
  buildOffersUrl,
  extractOffersState,
  readOffers,
  toPromo,
  selectEligiblePromos,
} = require('./src/services/mercadolivre-public');

// O separador que o Intl usa entre "R$" e o valor é espaço não separável.
assert.equal(formatCurrency(52.28), 'R$\u00A052,28');
assert.equal(getDiscountPercent(100, 75), 25);
assert.equal(getDiscountPercent(100, 100), 0);

assert.equal(normalizeText('Placa de Vídeo RTX 3060!'), 'placa de video rtx 3060');

// Sem palavras-chave configuradas, toda oferta passa.
assert.equal(matchesKeywords('Qualquer produto', []), true);
assert.equal(matchesKeywords('Placa De Vídeo RTX 3060 12GB', ['placa de video']), true);
assert.equal(matchesKeywords('Placa-mãe Asus B550M', ['placa de video']), false);
assert.equal(matchesKeywords('SSD NVMe 1TB Kingston', ['ssd nvme', 'monitor']), true);

assert.equal(buildOffersUrl('MLB1144'), 'https://www.mercadolivre.com.br/ofertas?category=MLB1144');
assert.equal(buildOffersUrl('MLB1648', 2), 'https://www.mercadolivre.com.br/ofertas?category=MLB1648&page=2');
assert.equal(buildOffersUrl('todas'), 'https://www.mercadolivre.com.br/ofertas');

// Amostra reduzida da página real: o estado do React fica entre
// `_n.ctx.r=` e `};_n.ctx.r.assets`, e os produtos ficam em appProps.
const state = {
  appProps: {
    pageProps: {
      data: {
        items: [
          {
            card: {
              metadata: { id: 'MLB111', url: 'www.mercadolivre.com.br/monitor-gamer/p/MLB111' },
              // O feed traz só o id da foto; a URL é montada a partir dele.
              pictures: { pictures: [{ id: '808703-MLA99523580704_122025' }] },
              components: [
                { type: 'title', title: { text: 'Monitor Gamer 24 Polegadas' } },
                {
                  type: 'price',
                  price: {
                    current_price: { value: 700 },
                    price_labels: [{ values: [{ type: 'price', price: { value: 1000, previous: true } }] }],
                  },
                },
              ],
            },
          },
          {
            // Item sem preço anterior: entra na lista, mas sem desconto.
            card: {
              metadata: { id: 'MLB222', url: 'https://www.mercadolivre.com.br/teclado/p/MLB222' },
              components: [
                { type: 'title', title: { text: 'Teclado Mecânico' } },
                { type: 'price', price: { current_price: { value: 250 } } },
              ],
            },
          },
          // Card quebrado: precisa ser descartado sem derrubar a leitura.
          { card: { metadata: {}, components: [] } },
        ],
      },
    },
  },
};
const html = `<html><script>_n.ctx.r=${JSON.stringify(state)};_n.ctx.r.assets.manifest=new Map([])</script></html>`;

assert.ok(extractOffersState(html));
assert.equal(extractOffersState('<html>sem estado</html>'), null);

const offers = readOffers(html);
assert.equal(offers.length, 2);
assert.deepEqual(offers[0], {
  id: 'MLB111',
  title: 'Monitor Gamer 24 Polegadas',
  permalink: 'https://www.mercadolivre.com.br/monitor-gamer/p/MLB111',
  price: 700,
  original_price: 1000,
  imageUrl: 'https://http2.mlstatic.com/D_NQ_NP_2X_808703-MLA99523580704_122025-F.webp',
});
assert.equal(offers[1].original_price, null);
// Card sem foto não pode inventar URL de imagem.
assert.equal(offers[1].imageUrl, null);
// Página sem o bloco de dados devolve null — diferente de lista vazia.
assert.equal(readOffers('<html>sem estado</html>'), null);

const promo = toPromo({
  id: 'MLB123',
  title: 'Jogo em promoção',
  price: 79.9,
  original_price: 129.9,
  permalink: 'https://www.mercadolivre.com.br/jogo-em-promocao/p/MLB123',
});
assert.equal(promo.id, 'MLB123');
assert.equal(promo.originalPrice, 'R$\u00A0129,90');
assert.equal(promo.currentPrice, 'R$\u00A079,90');
assert.equal(promo.discountPercent, 38);
assert.equal(promo.sourceGroup, 'Mercado Livre (ofertas do dia)');
assert.equal(toPromo({ id: 'MLB999', title: 'Sem desconto', price: 100, original_price: null, permalink: 'https://example.com' }), null);

const sorted = selectEligiblePromos([
  { id: 'MLB1', title: 'Desconto menor', price: 80, original_price: 100, permalink: 'https://example.com/1' },
  { id: 'MLB2', title: 'Desconto maior', price: 50, original_price: 100, permalink: 'https://example.com/2' },
]);
assert.equal(sorted[0].id, 'MLB2');

// Item sem desconto real não vira promoção.
assert.equal(selectEligiblePromos(offers).length, 1);

console.log('Coletor público do Mercado Livre: leitura das ofertas, filtros e preços válidos.');
