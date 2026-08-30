const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { normalizeImageUrl } = require('./src/utils/media');
const priceHistory = require('./src/services/price-history');
const health = require('./src/services/health');

// ---------- imagem ----------
// O AliExpress devolve a URL sem protocolo.
assert.equal(normalizeImageUrl('//host/foto.jpg'), 'https://host/foto.jpg');
assert.equal(normalizeImageUrl('https://host/foto.jpg'), 'https://host/foto.jpg');
assert.equal(normalizeImageUrl('http://host/foto.jpg'), 'http://host/foto.jpg');
assert.equal(normalizeImageUrl('foto.jpg'), null);
assert.equal(normalizeImageUrl(''), null);
assert.equal(normalizeImageUrl(null), null);

// ---------- histórico de preço ----------
// O módulo grava em disco; o arquivo real é preservado e devolvido no fim,
// para o teste não sujar o histórico de produção.
// O mesmo vale para o .health.json: sem esta guarda, rodar os testes
// injetava ciclos falsos no autodiagnóstico e o relatório passava a acusar
// falhas que nunca aconteceram — justamente o alarme falso que ele deveria
// evitar.
const ARQUIVOS_DE_ESTADO = ['.price_history.json', '.health.json']
  .map((nome) => path.resolve(__dirname, nome));
const estadoAntes = new Map(ARQUIVOS_DE_ESTADO.map((arquivo) => [
  arquivo,
  fs.existsSync(arquivo) ? fs.readFileSync(arquivo, 'utf8') : null,
]));
process.on('exit', () => {
  for (const [arquivo, conteudo] of estadoAntes) {
    if (conteudo === null) { try { fs.unlinkSync(arquivo); } catch (_) {} }
    else fs.writeFileSync(arquivo, conteudo, 'utf8');
  }
});

priceHistory.resetForTests();

// Primeira vez que o produto aparece: não há com o que comparar.
const primeira = priceHistory.evaluate('teste', 'p1', 100);
assert.equal(primeira.publicar, true);
assert.equal(primeira.menorPreco, 100);

// Mais barato que o menor já visto: passa e vira a nova referência.
assert.equal(priceHistory.evaluate('teste', 'p1', 80).publicar, true);

// Dentro da tolerância padrão de 5% sobre 80: passa.
assert.equal(priceHistory.evaluate('teste', 'p1', 83).publicar, true);

// Bem acima do menor já visto: é o "desconto" que o bot não deve anunciar,
// mesmo que a plataforma jure que é 60% OFF.
const cara = priceHistory.evaluate('teste', 'p1', 140);
assert.equal(cara.publicar, false);
assert.equal(cara.menorPreco, 80);
assert.match(cara.motivo, /80\.00.*140\.00/);

// Produtos de fontes diferentes não se misturam, mesmo com o mesmo id.
priceHistory.resetForTests();
priceHistory.evaluate('fonteA', 'mesmo-id', 10);
assert.equal(priceHistory.evaluate('fonteB', 'mesmo-id', 500).publicar, true);
assert.notEqual(priceHistory.keyFor('fonteA', 'x'), priceHistory.keyFor('fonteB', 'x'));

// Preço inválido não derruba nem bloqueia.
priceHistory.resetForTests();
assert.equal(priceHistory.evaluate('teste', 'p2', NaN).publicar, true);
assert.equal(priceHistory.evaluate('teste', 'p2', 0).publicar, true);

// O filtro em lote separa as boas das duvidosas.
priceHistory.resetForTests();
priceHistory.evaluate('teste', 'barato', 50);
const aprovadas = priceHistory.keepOnlyRealDeals([
  { id: 'barato', title: 'Voltou ao menor preço', priceValue: 50 },
  { id: 'barato', title: 'Bem acima do menor já visto', priceValue: 200 },
  { id: 'novo', title: 'Nunca visto antes', priceValue: 999 },
], 'teste');
assert.deepEqual(aprovadas.map((p) => p.title), ['Voltou ao menor preço', 'Nunca visto antes']);

// ---------- autodiagnóstico ----------
health.resetForTests();
assert.deepEqual(health.summarize(), []);

health.recordCycle('Mercado Livre', { read: 132, added: 2 });
health.recordCycle('Mercado Livre', { read: 130, added: 1 });
health.recordCycle('AliExpress', { error: 'timeout' });
health.recordCycle('AliExpress', { error: 'timeout' });
health.recordCycle('ITAD', { read: 0, added: 0 });

const resumo = health.summarize();
const porFonte = Object.fromEntries(resumo.map((linha) => [linha.fonte, linha]));

assert.equal(porFonte['Mercado Livre'].ciclos, 2);
assert.equal(porFonte['Mercado Livre'].lidos, 262);
assert.equal(porFonte['Mercado Livre'].enviados, 3);
assert.equal(porFonte['Mercado Livre'].saudavel, true);

// Todos os ciclos falharam: é exatamente o caso do ITAD respondendo 500.
assert.equal(porFonte['AliExpress'].falhas, 2);
assert.equal(porFonte['AliExpress'].saudavel, false);
assert.equal(porFonte['AliExpress'].ultimoErro, 'timeout');

// Rodou sem erro mas não leu nada: é o caso do Mercado Livre com a página
// mudada, que não levanta exceção e passaria despercebido.
assert.equal(porFonte['ITAD'].falhas, 0);
assert.equal(porFonte['ITAD'].saudavel, false);

// Fonte ligada que nunca reportou precisa aparecer: silêncio total é o
// pior dos casos e não pode sumir do relatório.
health.resetForTests();
const comFonteMuda = health.summarize(['AliExpress']);
assert.equal(comFonteMuda.length, 1);
assert.equal(comFonteMuda[0].ciclos, 0);
assert.equal(comFonteMuda[0].saudavel, false);

// WhatsApp e Telegram ficam de fora: silêncio neles é normal e viraria
// alarme falso.
const vigiadas = health.enabledSources();
assert.ok(!vigiadas.includes('WhatsApp'));
assert.ok(!vigiadas.includes('Telegram'));

// ---------- fila sobrevive a queda ----------
// A fila é salva a cada mudança e o arquivo some quando ela esvazia; se
// ficasse para trás, o próximo restart reenviaria promoções já entregues.
const QUEUE_FILE = path.resolve(__dirname, '.queue_backup.json');
const backupAntes = fs.existsSync(QUEUE_FILE) ? fs.readFileSync(QUEUE_FILE, 'utf8') : null;
try {
  const queue = require('./src/services/queue');
  queue.enqueue({ title: 'Promoção de teste', urls: ['https://exemplo.com/x'] });
  assert.ok(fs.existsSync(QUEUE_FILE), 'enqueue precisa gravar o backup na hora');
  const salvo = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  assert.ok(salvo.some((p) => p.title === 'Promoção de teste'));
} finally {
  if (backupAntes === null) { try { fs.unlinkSync(QUEUE_FILE); } catch (_) {} }
  else fs.writeFileSync(QUEUE_FILE, backupAntes, 'utf8');
}

console.log('Qualidade: imagem, histórico de preço, autodiagnóstico e backup da fila válidos.');
