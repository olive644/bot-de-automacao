const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { isQuietHour, minutesUntilQuietEnds, describeQuietWindow } = require('./src/utils/horario');
const { parseHorario, formatarHorario } = require('./src/utils/horario-parse');
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
const as = (hora, minuto = 30) => new Date(2026, 7, 30, hora, minuto, 0);
// Os horarios da configuracao sao minutos desde a meia-noite.
const emMinutos = (hora, minuto = 0) => hora * 60 + minuto;

// Janela 21h–6h cruza a meia-noite: a comparação não pode ser um simples
// "entre início e fim", senão nada cairia dentro dela.
assert.equal(isQuietHour(as(21), emMinutos(21), emMinutos(6)), true);
assert.equal(isQuietHour(as(23), emMinutos(21), emMinutos(6)), true);
assert.equal(isQuietHour(as(0), emMinutos(21), emMinutos(6)), true);
assert.equal(isQuietHour(as(3), emMinutos(21), emMinutos(6)), true);
assert.equal(isQuietHour(as(5), emMinutos(21), emMinutos(6)), true);
assert.equal(isQuietHour(as(6), emMinutos(21), emMinutos(6)), false);
assert.equal(isQuietHour(as(12), emMinutos(21), emMinutos(6)), false);
assert.equal(isQuietHour(as(20), emMinutos(21), emMinutos(6)), false);

// Janela que não vira o dia continua funcionando.
assert.equal(isQuietHour(as(2), emMinutos(1), emMinutos(6)), true);
assert.equal(isQuietHour(as(8), emMinutos(1), emMinutos(6)), false);

// Início igual ao fim seria silêncio de 24h ou de nada; tratamos como nada.
assert.equal(isQuietHour(as(3), emMinutos(6), emMinutos(6)), false);

// Quanto falta para acabar, para o log dizer algo útil.
assert.equal(minutesUntilQuietEnds(new Date(2026, 7, 30, 23, 0, 0), emMinutos(6)), 7 * 60);
assert.equal(minutesUntilQuietEnds(new Date(2026, 7, 30, 5, 30, 0), emMinutos(6)), 30);

assert.match(describeQuietWindow(), /\d{2}h(\d{2})? às \d{2}h(\d{2})?/);

// ---------- horário com minutos (22:30, 23:00 em ponto) ----------
// O usuário pediu "22 e meia" e depois mudou para "23 em ponto": a
// configuração precisa aceitar as duas formas sem trocar de unidade.
assert.equal(parseHorario('22:30'), 1350);
assert.equal(parseHorario('22h30'), 1350);
assert.equal(parseHorario('22.30'), 1350);
assert.equal(parseHorario('23'), 1380);
assert.equal(parseHorario('23:00'), 1380);
assert.equal(parseHorario('6'), 360);
assert.equal(parseHorario('06:00'), 360);
// Entrada vazia ou inválida cai no padrão em vez de virar NaN silencioso.
assert.equal(parseHorario('', 999), 999);
assert.equal(parseHorario(undefined, 999), 999);
assert.equal(parseHorario('abc', 999), 999);
assert.equal(parseHorario('25:00', 999), 999);
assert.equal(parseHorario('22:70', 999), 999);

assert.equal(formatarHorario(1380), '23h');
assert.equal(formatarHorario(1350), '22h30');
assert.equal(formatarHorario(360), '06h');

// A borda exata das 23:00 é o caso que importa: silêncio começa no minuto
// certo, nem antes nem depois.
assert.equal(isQuietHour(new Date(2026, 7, 30, 22, 59, 0), emMinutos(23), emMinutos(6)), false);
assert.equal(isQuietHour(new Date(2026, 7, 30, 23, 0, 0), emMinutos(23), emMinutos(6)), true);
assert.equal(isQuietHour(new Date(2026, 7, 30, 23, 1, 0), emMinutos(23), emMinutos(6)), true);

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
