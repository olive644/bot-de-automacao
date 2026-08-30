// ============================================
// Marca d'água nas imagens que vão para o grupo de destino.
//
// Usa jimp, que é JavaScript puro: não compila binário nativo, o que
// importa porque a imagem Docker do projeto nunca foi construída aqui e
// um módulo nativo quebraria justamente lá.
//
// jimp lê JPEG e PNG, mas não WEBP nem AVIF. Por isso os coletores pedem
// jpeg/png às CDNs — ver src/utils/media.js.
// ============================================

const fs = require('fs');
const { Jimp, loadFont, measureText, measureTextHeight } = require('jimp');
const fonts = require('jimp/fonts');
const config = require('../config');
const logger = require('./logger');

const FORMATOS_SUPORTADOS = new Set(['image/jpeg', 'image/png']);
// Quase opaco: a etiqueta e pequena, entao pode ser solida sem cobrir o
// produto, e o texto sai nitido em vez de esmaecido.
const OPACIDADE_FAIXA = 0x000000d0;

let fonteCache = new Map();

async function carregarFonte(largura) {
  // Fonte proporcional: em imagem pequena, texto grande cobre o produto.
  const nome = largura >= 700 ? fonts.SANS_32_WHITE : fonts.SANS_16_WHITE;
  if (!fonteCache.has(nome)) fonteCache.set(nome, await loadFont(nome));
  return fonteCache.get(nome);
}

/**
 * Carrega o símbolo do Oli e o redimensiona para a altura do texto, de modo
 * que os dois fiquem do mesmo tamanho na etiqueta.
 *
 * O arquivo é lido uma vez e guardado em memória: o mesmo símbolo vai em
 * toda promoção, e reler o PNG a cada envio seria desperdício.
 */
async function carregarSimbolo(alturaAlvo) {
  if (!config.watermarkLogo) return null;
  const chave = `simbolo:${alturaAlvo}`;
  if (fonteCache.has(chave)) return fonteCache.get(chave);

  try {
    if (!fs.existsSync(config.watermarkLogo)) {
      logger.debug(`[Marca] Símbolo não encontrado em ${config.watermarkLogo}.`);
      fonteCache.set(chave, null);
      return null;
    }
    const simbolo = await Jimp.read(config.watermarkLogo);
    const lado = Math.max(12, Math.round(alturaAlvo * 1.25));
    simbolo.resize({ w: lado, h: lado });
    fonteCache.set(chave, simbolo);
    return simbolo;
  } catch (error) {
    logger.warn('[Marca] Não foi possível carregar o símbolo; a marca sai só com o texto:', error.message);
    fonteCache.set(chave, null);
    return null;
  }
}

/**
 * Aplica a marca d'água e devolve a imagem no mesmo formato de mídia que a
 * fila espera. Devolve a original inalterada em qualquer contratempo:
 * marca d'água é acabamento, e falhar nela não pode impedir a oferta.
 */
async function applyWatermark(media, texto = config.watermarkText) {
  if (!config.watermarkEnabled) return media;
  if (!media || !media.data || !media.mimetype) return media;
  if (!texto) return media;

  if (!FORMATOS_SUPORTADOS.has(media.mimetype)) {
    logger.debug(`[Marca] ${media.mimetype} não é suportado; imagem segue sem marca.`);
    return media;
  }

  try {
    const imagem = await Jimp.read(Buffer.from(media.data, 'base64'));
    const largura = imagem.width;
    const altura = imagem.height;
    if (!largura || !altura) return media;

    const fonte = await carregarFonte(largura);
    const larguraTexto = measureText(fonte, texto);
    const alturaTexto = measureTextHeight(fonte, texto, larguraTexto);

    // Etiqueta compacta, e não faixa de ponta a ponta. Muita foto de
    // produto já traz banner do vendedor no rodapé, e uma faixa larga
    // por cima vira sopa: a marca briga com o texto que já estava lá.
    const respiro = Math.max(4, Math.round(alturaTexto * 0.35));
    const margem = Math.max(6, Math.round(Math.min(largura, altura) * 0.025));

    const simbolo = await carregarSimbolo(alturaTexto);
    const espacoSimbolo = simbolo ? simbolo.width + respiro : 0;

    const larguraEtiqueta = Math.min(largura, larguraTexto + espacoSimbolo + respiro * 2);
    const alturaEtiqueta = Math.min(altura, Math.max(alturaTexto, simbolo ? simbolo.height : 0) + respiro * 2);

    // Sem o fundo, texto branco some em foto clara. Com ele, a marca fica
    // legível sobre qualquer produto.
    const etiqueta = new Jimp({
      width: larguraEtiqueta,
      height: alturaEtiqueta,
      color: OPACIDADE_FAIXA,
    });
    const x = Math.max(0, largura - larguraEtiqueta - margem);
    const y = Math.max(0, altura - alturaEtiqueta - margem);
    imagem.composite(etiqueta, x, y);

    if (simbolo) {
      imagem.composite(simbolo, x + respiro, y + Math.round((alturaEtiqueta - simbolo.height) / 2));
    }

    imagem.print({
      font: fonte,
      x: x + respiro + espacoSimbolo,
      y: y + Math.round((alturaEtiqueta - alturaTexto) / 2),
      text: texto,
    });

    const buffer = await imagem.getBuffer('image/jpeg', { quality: config.watermarkQuality });
    return {
      mimetype: 'image/jpeg',
      data: buffer.toString('base64'),
      filename: media.filename || 'oferta.jpg',
    };
  } catch (error) {
    logger.warn('[Marca] Não foi possível aplicar a marca d\'água; imagem segue original:', error.message);
    return media;
  }
}

function resetFontCacheForTests() {
  fonteCache = new Map();
}

module.exports = { applyWatermark, resetFontCacheForTests, FORMATOS_SUPORTADOS };
