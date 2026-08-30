const assert = require('node:assert/strict');
const {
  chatIdentifiers,
  normalizeSource,
  isConfiguredChat,
  chatLabel,
  readPost,
  getPostText,
} = require('./src/services/telegram');

// O .env aceita id numérico, @usuario, usuario sem arroba e link do t.me.
assert.equal(normalizeSource('-1001234567890'), '-1001234567890');
assert.equal(normalizeSource('@OfertasTech'), '@ofertastech');
assert.equal(normalizeSource('OfertasTech'), '@ofertastech');
assert.equal(normalizeSource('https://t.me/OfertasTech'), '@ofertastech');
assert.equal(normalizeSource('t.me/s/OfertasTech'), '@ofertastech');
assert.equal(normalizeSource('  '), '');

assert.deepEqual(chatIdentifiers({ id: -1001234567890, username: 'OfertasTech' }), ['-1001234567890', '@ofertastech']);
assert.deepEqual(chatIdentifiers({ id: -100999 }), ['-100999']);
assert.deepEqual(chatIdentifiers(null), []);

const grupo = { id: -1001234567890, title: 'Ofertas Tech', username: 'OfertasTech' };
assert.equal(isConfiguredChat(grupo, ['-1001234567890']), true);
assert.equal(isConfiguredChat(grupo, ['@ofertastech']), true);
assert.equal(isConfiguredChat(grupo, ['https://t.me/OfertasTech']), true);
assert.equal(isConfiguredChat(grupo, ['@outro']), false);
// Lista vazia não pode virar "escuta tudo": seria repassar o Telegram inteiro.
assert.equal(isConfiguredChat(grupo, []), false);

assert.equal(chatLabel(grupo), 'Ofertas Tech');
assert.equal(chatLabel({ id: -100999, username: 'canal' }), '@canal');
assert.equal(chatLabel({ id: -100999 }), '-100999');

// Grupo, canal e as versões editadas de cada um.
assert.equal(readPost({ message: { text: 'a' } }).text, 'a');
assert.equal(readPost({ channel_post: { text: 'b' } }).text, 'b');
assert.equal(readPost({ edited_channel_post: { text: 'c' } }).text, 'c');
assert.equal(readPost({ poll: {} }), null);

assert.equal(getPostText({ text: 'Oferta' }), 'Oferta');
// Post com foto traz o texto em caption.
assert.equal(getPostText({ caption: 'Oferta com foto' }), 'Oferta com foto');
assert.equal(getPostText({ text: '   ', caption: 'Legenda' }), 'Legenda');
assert.equal(getPostText({}), '');

console.log('Fonte Telegram: identificação de chats, updates e textos válidos.');
