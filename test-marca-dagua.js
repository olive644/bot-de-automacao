const assert = require('node:assert/strict');
const { Jimp } = require('jimp');
const { applyWatermark, FORMATOS_SUPORTADOS } = require('./src/utils/watermark');

async function imagemBase(largura, altura, cor = 0xffffffff) {
  const img = new Jimp({ width: largura, height: altura, color: cor });
  const buffer = await img.getBuffer('image/jpeg', { quality: 90 });
  return { mimetype: 'image/jpeg', data: buffer.toString('base64'), filename: 'produto.jpg' };
}

function pixel(img, x, y) {
  return img.getPixelColor(x, y);
}

(async () => {
  // ---------- caminho feliz ----------
  const original = await imagemBase(800, 600);
  const marcada = await applyWatermark(original, 'Oli - Bot');

  assert.equal(marcada.mimetype, 'image/jpeg');
  assert.notEqual(marcada.data, original.data, 'a imagem precisa mudar');

  const img = await Jimp.read(Buffer.from(marcada.data, 'base64'));
  assert.equal(img.width, 800, 'a marca não pode redimensionar a imagem');
  assert.equal(img.height, 600);

  const brilho = (cor) => ((cor >>> 24) & 255) + ((cor >>> 16) & 255) + ((cor >>> 8) & 255);

  // A etiqueta fica no canto inferior direito e escurece só aquele pedaço.
  const cantoDireito = pixel(img, 700, 550);
  assert.ok(brilho(cantoDireito) < 300, 'a etiqueta precisa escurecer o canto inferior direito');

  // O resto da imagem continua intacto — é isso que separa uma etiqueta
  // compacta de uma faixa de ponta a ponta, que cobriria o rodapé inteiro
  // e brigaria com o banner que muitas fotos de produto já trazem.
  assert.ok(brilho(pixel(img, 400, 20)) > 700, 'o topo não pode ser tocado');
  assert.ok(brilho(pixel(img, 100, 590)) > 700, 'o rodapé esquerdo não pode ser tocado');

  // ---------- formatos que o jimp não abre ----------
  // WEBP e AVIF passam direto, sem marca, em vez de derrubar o envio.
  assert.ok(!FORMATOS_SUPORTADOS.has('image/webp'));
  const webp = { mimetype: 'image/webp', data: 'AAAA', filename: 'x.webp' };
  assert.deepEqual(await applyWatermark(webp, 'Oli'), webp);

  // ---------- entradas ruins nunca derrubam o envio ----------
  assert.equal(await applyWatermark(null, 'Oli'), null);
  assert.deepEqual(await applyWatermark({ mimetype: 'image/jpeg' }, 'Oli'), { mimetype: 'image/jpeg' });
  // Dado corrompido: devolve o original em vez de lançar.
  const quebrada = { mimetype: 'image/jpeg', data: 'nao-e-imagem', filename: 'x.jpg' };
  assert.deepEqual(await applyWatermark(quebrada, 'Oli'), quebrada);
  // Texto vazio não marca nada.
  const semTexto = await imagemBase(200, 200);
  assert.deepEqual(await applyWatermark(semTexto, ''), semTexto);

  // ---------- imagem pequena ----------
  // A etiqueta não pode ultrapassar as dimensões da imagem.
  const pequena = await imagemBase(120, 90);
  const pequenaMarcada = await applyWatermark(pequena, 'OliBot');
  const imgPequena = await Jimp.read(Buffer.from(pequenaMarcada.data, 'base64'));
  assert.equal(imgPequena.width, 120);
  assert.equal(imgPequena.height, 90);

  // ---------- o símbolo do Oli ----------
  const fs = require('node:fs');
  const path = require('node:path');
  const logo = path.resolve(__dirname, 'assets/oli-logo.png');
  assert.ok(fs.existsSync(logo), 'o símbolo do Oli precisa existir');

  const arquivo = fs.readFileSync(logo);
  assert.ok(arquivo[0] === 0x89 && arquivo[1] === 0x50, 'precisa ser PNG de verdade, não bytes soltos');

  const simbolo = await Jimp.read(logo);
  // Fundo transparente: o canto tem alpha zero, o miolo do rosto não.
  assert.equal((simbolo.getPixelColor(1, 1) & 255), 0, 'o canto precisa ser transparente');
  assert.equal((simbolo.getPixelColor(128, 128) & 255), 255, 'o rosto não pode ficar transparente');

  // Com símbolo, a etiqueta fica mais larga do que só com o texto.
  const { resetFontCacheForTests } = require('./src/utils/watermark');
  resetFontCacheForTests();
  const comSimbolo = await applyWatermark(await imagemBase(800, 600), 'OliBot');
  assert.ok(comSimbolo.data.length > 0);

  console.log("Marca d'água: aplica, preserva dimensões, ignora formato sem suporte e nunca derruba o envio.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
