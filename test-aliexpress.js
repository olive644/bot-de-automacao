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

const base = toOfferItem(card('1005010368393943', 'Placa de vídeo RX580', 1075.44, 677.52));
assert.equal(base.id, '1005010368393943');
assert.equal(base.title, 'Placa de vídeo RX580');
assert.equal(base.permalink, 'https://pt.aliexpress.com/item/1005010368393943.html');
assert.equal(base.price, 677.52);
assert.equal(base.original_price, 1075.44);
assert.equal(base.imageUrl, null);
// Sem o selo local_flag, o pedido vem de fora e pode pegar imposto.
assert.equal(base.origin, 'internacional');
// Titulo com uma capacidade so: nao e anuncio de varias versoes.
assert.equal(base.multiVariant, false);

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

// ---------- anuncio com varias versoes e descartado ----------
// O caso real: um SSD 128GB/256GB/512GB/1TB/2TB anunciado por R$ 201,97
// tem a versao de 2TB a R$ 1.533,86. Avisar nao bastava, porque quem le
// o valor em destaque nao vai conferir o anuncio.
const multiVersao = card('1005010064016845', 'SSD Interno Great Wall M.2 NVME PCIe3.0 128GB 256GB 512GB 1TB 2TB', 504.60, 201.97);
assert.equal(toOfferItem(multiVersao).multiVariant, true);
assert.equal(toPromo(toOfferItem(multiVersao)), null);

// Uma capacidade so no titulo continua passando.
const umaVersao = toOfferItem(card('777', 'SSD NVMe 1TB Kingston NV2', 400, 160));
assert.equal(umaVersao.multiVariant, false);
assert.ok(toPromo(umaVersao));

console.log('Coletor AliExpress: leitura da busca, moeda, filtros e preços válidos.');
