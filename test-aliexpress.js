const assert = require('node:assert/strict');
const {
  formatCurrency,
  getDiscountPercent,
  buildSearchUrl,
  extractSearchState,
  readOffers,
  toOfferItem,
  toPromo,
  selectEligiblePromos,
} = require('./src/services/aliexpress');

assert.equal(formatCurrency(677.52), 'R$ 677,52');
assert.equal(getDiscountPercent(1075.44, 677.52), 37);
assert.equal(getDiscountPercent(100, 100), 0);

assert.equal(buildSearchUrl('placa de vídeo'), 'https://pt.aliexpress.com/w/wholesale-placa-de-video.html');
assert.equal(buildSearchUrl('SSD NVMe'), 'https://pt.aliexpress.com/w/wholesale-ssd-nvme.html');

function card(id, titulo, original, atual, moeda = 'BRL') {
  return {
    productId: id,
    title: { displayTitle: titulo },
    prices: {
      currencySymbol: 'R$',
      originalPrice: { currencyCode: moeda, minPrice: original },
      salePrice: { currencyCode: moeda, minPrice: atual },
    },
  };
}

assert.deepEqual(toOfferItem(card('1005010368393943', 'Placa de vídeo RX580', 1075.44, 677.52)), {
  id: '1005010368393943',
  title: 'Placa de vídeo RX580',
  permalink: 'https://pt.aliexpress.com/item/1005010368393943.html',
  price: 677.52,
  original_price: 1075.44,
  imageUrl: null,
});

// A imgUrl do AliExpress vem sem protocolo; quem normaliza é o utilitário
// de mídia, na hora do envio.
const comFoto = card('111', 'Com foto', 200, 100);
comFoto.image = { imgUrl: '//ae-pic-a1.aliexpress-media.com/kf/Se11.jpg' };
assert.equal(toOfferItem(comFoto).imageUrl, '//ae-pic-a1.aliexpress-media.com/kf/Se11.jpg');

// Preço em outra moeda é descartado: anunciar dólar num grupo brasileiro
// seria enganoso.
assert.equal(toOfferItem(card('999', 'Item em dolar', 100, 50, 'USD')), null);
assert.equal(toOfferItem({ productId: '1', title: {} }), null);
assert.equal(toOfferItem(null), null);

// A chave externa do estado vem sem aspas, entao JSON.parse direto falharia.
// A extração precisa casar chaves respeitando aspas e escapes — inclusive
// quando o título traz "{" ou aspas escapadas.
// Mesmo aninhamento da página real: o valor de `data:` traz `hierarchy` e
// um segundo `data`, que é onde ficam os produtos.
const conteudo = {
  hierarchy: { root: 'root' },
  data: {
    root: {
      fields: {
        mods: {
          itemList: {
            content: [
              card('111', 'Teclado {gamer} com "RGB"', 200, 100),
              card('222', 'Item sem desconto', 50, 50),
              card('333', 'Item em dolar', 100, 40, 'USD'),
            ],
          },
        },
      },
    },
  },
};
const html = `<script>/*!-->init-data-start--*/\nwindow._dida_config_._init_data_= { data: ${JSON.stringify(conteudo)} };</script>`;

assert.ok(extractSearchState(html));
assert.equal(extractSearchState('<html>sem estado</html>'), null);

const offers = readOffers(html);
// O item em dólar sai; o sem desconto fica, e é toPromo quem o descarta.
assert.equal(offers.length, 2);
assert.equal(offers[0].title, 'Teclado {gamer} com "RGB"');
assert.equal(offers[0].permalink, 'https://pt.aliexpress.com/item/111.html');
// Página sem o bloco devolve null — diferente de lista vazia.
assert.equal(readOffers('<html>sem estado</html>'), null);

const promo = toPromo({
  id: '111',
  title: 'Teclado mecânico',
  price: 100,
  original_price: 200,
  permalink: 'https://pt.aliexpress.com/item/111.html',
});
assert.equal(promo.discountPercent, 50);
assert.equal(promo.originalPrice, 'R$ 200,00');
assert.equal(promo.currentPrice, 'R$ 100,00');
assert.equal(promo.sourceGroup, 'AliExpress');

assert.equal(selectEligiblePromos(offers).length, 1);

console.log('Coletor AliExpress: leitura da busca, moeda, filtros e preços válidos.');
