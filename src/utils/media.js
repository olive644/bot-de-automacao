// ============================================
// Download da imagem do produto para envio no WhatsApp.
//
// A imagem é baixada na hora do envio, não na coleta: assim a fila em
// disco não carrega centenas de KB em base64 por promoção, e nada é
// baixado para oferta que acabe descartada antes de sair.
// ============================================

const logger = require('./logger');

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 20000;
// Pedimos só jpeg e png de propósito. Com "image/avif,image/webp" na
// frente, as CDNs negociam para esses formatos — e a marca d'água não
// consegue abri-los. O AliExpress, por exemplo, devolve AVIF quando a
// gente aceita, e JPEG quando não aceita.
const HEADERS = {
  accept: 'image/jpeg,image/png',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

/**
 * Aceita URL com protocolo ou começando em "//", como o AliExpress devolve.
 */
function normalizeImageUrl(url) {
  const value = String(url || '').trim();
  if (!value) return null;
  if (value.startsWith('//')) return `https:${value}`;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

/**
 * Baixa a imagem e devolve no formato que a fila usa.
 * Nunca lança: imagem é enfeite, e falhar nela não pode impedir o envio
 * do texto da promoção.
 */
async function downloadImage(url) {
  const alvo = normalizeImageUrl(url);
  if (!alvo) return null;

  try {
    const response = await fetch(alvo, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
      logger.debug(`[Imagem] ${alvo} respondeu ${response.status}.`);
      return null;
    }

    const mimetype = (response.headers.get('content-type') || '').split(';')[0].trim();
    if (!mimetype.startsWith('image/')) {
      logger.debug(`[Imagem] ${alvo} não é imagem (${mimetype || 'sem tipo'}).`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) {
      logger.debug(`[Imagem] ${alvo} tem ${buffer.byteLength} bytes; fora do limite.`);
      return null;
    }

    return {
      mimetype,
      data: buffer.toString('base64'),
      filename: 'oferta.jpg',
    };
  } catch (error) {
    logger.debug(`[Imagem] Falha ao baixar ${alvo}: ${error.message}`);
    return null;
  }
}

module.exports = { normalizeImageUrl, downloadImage, MAX_IMAGE_BYTES };
