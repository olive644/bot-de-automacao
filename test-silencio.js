const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { isQuietHour, minutesUntilQuietEnds, describeQuietWindow } = require('./src/utils/horario');
const dedupe = require('./src/services/dedupe');

// Os módulos de estado gravam em disco; preservar e devolver evita que a
// suíte suje o histórico de produção — lição aprendida da vez em que os
// testes injetaram promoções falsas na fila real.
const ARQUIVOS = ['.dedupe.json'].map((n) => path.resolve(__dirname, n));
const antes = new Map(ARQUIVOS.map((a) => [a, fs.existsSync(a) ? fs.readFileSync(a, 'utf8') : null]));
process.on('exit', () => {
  for (const [arquivo, conteudo] of antes) {
    if (conteudo === null) { try { fs.unlinkSync(arquivo); } catch (_) {} }
    else fs.writeFileSync(arquivo, conteudo, 'utf8');
  }
});

// ---------- horário de silêncio ----------
const as = (hora) => new Date(2026, 7, 30, hora, 30, 0);

// Janela 21h–6h cruza a meia-noite: a comparação não pode ser um simples
// "entre início e fim", senão nada cairia dentro dela.
assert.equal(isQuietHour(as(21), 21, 6), true);
assert.equal(isQuietHour(as(23), 21, 6), true);
assert.equal(isQuietHour(as(0), 21, 6), true);
assert.equal(isQuietHour(as(3), 21, 6), true);
assert.equal(isQuietHour(as(5), 21, 6), true);
assert.equal(isQuietHour(as(6), 21, 6), false);
assert.equal(isQuietHour(as(12), 21, 6), false);
assert.equal(isQuietHour(as(20), 21, 6), false);

// Janela que não vira o dia continua funcionando.
assert.equal(isQuietHour(as(2), 1, 6), true);
assert.equal(isQuietHour(as(8), 1, 6), false);

// Início igual ao fim seria silêncio de 24h ou de nada; tratamos como nada.
assert.equal(isQuietHour(as(3), 6, 6), false);

// Quanto falta para acabar, para o log dizer algo útil.
assert.equal(minutesUntilQuietEnds(new Date(2026, 7, 30, 23, 0, 0), 6), 7 * 60);
assert.equal(minutesUntilQuietEnds(new Date(2026, 7, 30, 5, 30, 0), 6), 30);

assert.match(describeQuietWindow(), /\d{2}h às \d{2}h/);

// ---------- não repetir entre fontes ----------
dedupe.resetForTests();

// Parâmetro de rastreio não faz do link outro produto.
assert.equal(
  dedupe.canonicalUrl('https://www.amazon.com.br/dp/B01?tag=abc&utm_source=x'),
  'amazon.com.br/dp/b01'
);
assert.equal(dedupe.canonicalUrl('https://amazon.com.br/dp/B01/'), 'amazon.com.br/dp/b01');
assert.equal(dedupe.canonicalUrl('nao-e-url'), 'nao-e-url');

// A chave é o link e também o cupom.
const chaves = dedupe.keysFor({ urls: ['https://loja.com/p/1'], coupons: ['natorcida'] });
assert.ok(chaves.includes('url:loja.com/p/1'));
assert.ok(chaves.includes('cupom:NATORCIDA'));

// Primeira vez passa; a mesma oferta de outra fonte, não.
const doLopes = { title: 'Cupom Amazon', urls: ['https://link.amazon/B07'], coupons: ['NATORCIDA'] };
const doTosemkit = { title: 'Cupom Amazon 30% OFF', urls: ['https://link.amazon/OUTRO'], coupons: ['natorcida'] };
assert.equal(dedupe.isDuplicate(doLopes), false);
// Link diferente, mas o mesmo cupom — era exatamente o caso medido nos
// canais: NATORCIDA chegava por LopesPromo e por tosemkit.
assert.equal(dedupe.isDuplicate(doTosemkit), true);

// Mesmo produto achado por duas plataformas, com rastreio diferente.
dedupe.resetForTests();
assert.equal(dedupe.isDuplicate({ urls: ['https://loja.com/p/9?utm=ml'] }), false);
assert.equal(dedupe.isDuplicate({ urls: ['https://www.loja.com/p/9/?utm=ali'] }), true);

// Promoção sem link nem cupom não tem como ser comparada: passa.
dedupe.resetForTests();
assert.equal(dedupe.isDuplicate({ title: 'sem nada' }), false);
assert.equal(dedupe.isDuplicate({ title: 'sem nada' }), false);

console.log('Silêncio e repetição: janela que vira o dia, link canônico e cupom repetido entre canais.');
