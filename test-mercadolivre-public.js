const assert = require('node:assert/strict');

// O Intl separa "R$" do valor com espaco nao separavel. Normalizar aqui
// deixa as asercoes legiveis sem escapes no meio do texto.
const semNbsp = (texto) => String(texto).replace(/\u00A0/g, " ");
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
                    installments: { text: '10x {price} sem juros', values: [{ key: 'price', type: 'price', price: { value: 70 } }] },
                  },
                },
                // Os textos do feed vêm como template com marcadores; o
                // ícone não tem valor e precisa sumir, não virar "{icon}".
                { type: 'seller', seller: { text: 'TNT Info {icon_cockade}', values: [] } },
                { type: 'shipping_v2', shipping_v2: [{ text: 'Frete grátis' }] },
                { type: 'variations_text', variations_text: { text: 'Disponível em 3 cores' } },
                {
                  type: 'promotions',
                  promotions: [{ type: 'coupon', text: '{1} com Cupom', values: [{ key: '1', type: 'price', price: { value: 159.62 } }] }],
                },
                { type: 'review_compacted', review_compacted: { alt_text: 'Classificação 4,9 de 5 estrelas. Mais de 500 produtos vendidos.' } },
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

assert.equal(offers[0].id, 'MLB111');
assert.equal(offers[0].title, 'Monitor Gamer 24 Polegadas');
assert.equal(offers[0].permalink, 'https://www.mercadolivre.com.br/monitor-gamer/p/MLB111');
assert.equal(offers[0].price, 700);
assert.equal(offers[0].original_price, 1000);
// -O.jpg, e nao -F.webp: a marca d'agua nao abre WEBP e a CDN do
// Mercado Livre ignora o cabecalho que pede jpeg.
assert.equal(offers[0].imageUrl, 'https://http2.mlstatic.com/D_NQ_NP_2X_808703-MLA99523580704_122025-O.jpg');

// Os campos que deixam a mensagem explicativa. O marcador do ícone tem que
// sumir do texto do vendedor: mandar "{icon_cockade}" para o grupo seria
// vazar detalhe interno do feed.
assert.equal(offers[0].seller, 'TNT Info');
assert.equal(offers[0].shipping, 'Frete grátis');
assert.equal(semNbsp(offers[0].installments), '10x R$ 70,00 sem juros');
assert.equal(offers[0].variants, 'Disponível em 3 cores');
assert.equal(semNbsp(offers[0].coupon), 'R$ 159,62 com Cupom');
assert.equal(offers[0].rating, '4.9');
assert.equal(offers[0].sales, 'Mais de 500 vendidos');
// Sem componente `cbt` nem "envio da China": produto nacional.
assert.equal(offers[0].origin, 'nacional');
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
