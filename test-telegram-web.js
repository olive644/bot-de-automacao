const assert = require('node:assert/strict');
const {
  normalizeChannel,
  decodeEntities,
  stripTags,
  parseMessages,
  toPromo,
  readChannelTitle,
} = require('./src/services/telegram-web');

// ---------- identificação do canal ----------
assert.equal(normalizeChannel('https://t.me/LopesPromo'), 'LopesPromo');
assert.equal(normalizeChannel('https://t.me/s/LopesPromo'), 'LopesPromo');
assert.equal(normalizeChannel('t.me/tosemkit/'), 'tosemkit');
assert.equal(normalizeChannel('@GamePlaysCassi'), 'GamePlaysCassi');
assert.equal(normalizeChannel('GamePlaysCassi'), 'GamePlaysCassi');
assert.equal(normalizeChannel('   '), '');

// ---------- entidades HTML ----------
// O Telegram escapa o cifrão na prévia. Sem desfazer isso, o preço da
// promoção nunca casa com o padrão e a oferta sai sem valor — falha
// silenciosa, porque o texto continua legível para quem lê.
assert.equal(decodeEntities('limite R&#036; 30'), 'limite R$ 30');
assert.equal(decodeEntities('Pile Up&#33;'), 'Pile Up!');
assert.equal(decodeEntities('&lt;b&gt;oferta&lt;/b&gt;'), '<b>oferta</b>');
assert.equal(decodeEntities('caf&#xe9;'), 'café');
// &amp; é desfeito por último: antes dele, "&amp;#036;" viraria "$" cedo demais.
assert.equal(decodeEntities('a &amp;#036; b'), 'a &#036; b');

assert.equal(stripTags('linha um<br/>linha dois'), 'linha um\nlinha dois');
assert.equal(stripTags('<a href="x">texto</a>'), 'texto');

// ---------- leitura da prévia ----------
const html = `
<div class="tgme_channel_info_header_title"><span dir="auto">Lopes Promo&#0231;&#0245;es</span></div>
<div class="tgme_widget_message_wrap js-widget_message_wrap">
  <div class="tgme_widget_message" data-post="LopesPromo/1001">
    <a class="tgme_widget_message_photo_wrap" style="background-image:url('https://cdn.telegram.org/foto1.jpg')"></a>
    <div class="tgme_widget_message_text js-message_text" dir="auto">Mouse Gamer<br/>De: R&#036; 199,90<br/>Por: R&#036; 99,90<br/>Cupom: MOUSE10<br/>https://exemplo.com.br/mouse</div>
  </div>
</div>
<div class="tgme_widget_message_wrap js-widget_message_wrap">
  <div class="tgme_widget_message" data-post="LopesPromo/1002">
    <div class="tgme_widget_message_text js-message_text" dir="auto">Bom dia pessoal, sem link nenhum aqui</div>
  </div>
</div>
`;

assert.equal(readChannelTitle(html), 'Lopes Promoções');

const mensagens = parseMessages(html, 'LopesPromo');
assert.equal(mensagens.length, 2);
assert.equal(mensagens[0].id, 'LopesPromo/1001');
assert.equal(mensagens[0].permalink, 'https://t.me/LopesPromo/1001');
assert.equal(mensagens[0].imageUrl, 'https://cdn.telegram.org/foto1.jpg');
assert.match(mensagens[0].text, /R\$ 199,90/);
// Post sem foto não pode inventar imagem.
assert.equal(mensagens[1].imageUrl, null);

// ---------- promoção ----------
const promo = toPromo(mensagens[0], 'Lopes Promoções');
assert.equal(promo.id, 'LopesPromo/1001');
assert.equal(promo.title, 'Mouse Gamer');
assert.deepEqual(promo.urls, ['https://exemplo.com.br/mouse']);
// O preço só aparece porque as entidades foram desfeitas antes.
assert.equal(promo.originalPrice, 'R$ 199,90');
assert.equal(promo.currentPrice, 'R$ 99,90');
assert.deepEqual(promo.coupons, ['MOUSE10']);
assert.equal(promo.sourceGroup, 'Telegram: Lopes Promoções');
assert.equal(promo.imageUrl, 'https://cdn.telegram.org/foto1.jpg');

// Mensagem sem link não vira promoção — é recado de canal, não oferta.
assert.equal(toPromo(mensagens[1], 'Lopes Promoções'), null);

// ---------- link de divulgação ----------
// Canal assina quase todo post com o link dos próprios grupos. Esse link
// não é a oferta e não deve ir para o destino; o do produto sim.
const comDivulgacao = parseMessages(`
<div class="tgme_widget_message_wrap js-widget_message_wrap">
  <div class="tgme_widget_message" data-post="LopesPromo/1003">
    <div class="tgme_widget_message_text js-message_text" dir="auto">Teclado<br/>Por: R&#036; 89,90<br/>https://loja.com.br/teclado<br/>Grupos de ofertas: https://beacons.ai/lopesyt</div>
  </div>
</div>
`, 'LopesPromo');
assert.deepEqual(toPromo(comDivulgacao[0], 'Lopes').urls, ['https://loja.com.br/teclado']);

// Post que só tem link de divulgação não é oferta nenhuma.
const soDivulgacao = parseMessages(`
<div class="tgme_widget_message_wrap js-widget_message_wrap">
  <div class="tgme_widget_message" data-post="LopesPromo/1004">
    <div class="tgme_widget_message_text js-message_text" dir="auto">Entra nos nossos grupos: https://beacons.ai/lopesyt</div>
  </div>
</div>
`, 'LopesPromo');
assert.equal(toPromo(soDivulgacao[0], 'Lopes'), null);

// Página sem mensagem nenhuma não quebra a leitura.
assert.deepEqual(parseMessages('<html>vazio</html>', 'x'), []);

console.log('Canais públicos do Telegram: identificação, entidades, leitura e promoções válidas.');
