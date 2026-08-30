// ============================================
// Serviço de conversão de links de afiliado
// PLACEHOLDER: preparado para Mercado Livre, Amazon, etc.
// ============================================

const logger = require('../utils/logger');

/**
 * Detecta a plataforma de e-commerce a partir da URL.
 *
 * @param {string} url - URL original do produto
 * @returns {'mercadolivre'|'amazon'|'shopee'|'magazineluiza'|'unknown'}
 */
function detectPlatform(url) {
  const lower = url.toLowerCase();

  if (lower.includes('mercadolivre.com') || lower.includes('produto.mercadolivre')) {
    return 'mercadolivre';
  }
  if (lower.includes('amazon.com.br') || lower.includes('amzn.to')) {
    return 'amazon';
  }
  if (lower.includes('shopee.com.br') || lower.includes('shope.ee')) {
    return 'shopee';
  }
  if (lower.includes('magazineluiza.com') || lower.includes('magalu.com')) {
    return 'magazineluiza';
  }

  return 'unknown';
}

/**
 * Converte um link original para o link de afiliado.
 *
 * IMPORTANTE: Esta é uma implementação MOCK/placeholder.
 * Quando você integrar com as APIs reais, substitua a lógica
 * dentro de cada case pelo fluxo de conversão da plataforma.
 *
 * Exemplo de fluxo real para Mercado Livre:
 *   1. Extrair o item_id da URL
 *   2. Chamar a API de afiliados do ML para gerar o link
 *   3. Retornar o link gerado
 *
 * @param {string} originalUrl - URL original do produto
 * @returns {{ originalUrl: string, affiliateUrl: string, platform: string }}
 */
function convertLink(originalUrl) {
  const platform = detectPlatform(originalUrl);

  let affiliateUrl;

  switch (platform) {
    case 'mercadolivre':
      // TODO: Integrar com API de Afiliados do Mercado Livre
      // https://developers.mercadolivre.com.br/
      affiliateUrl = `${originalUrl}${originalUrl.includes('?') ? '&' : '?'}aff_source=SEU_ID_AFILIADO`;
      logger.debug(`[Afiliado] Mercado Livre (mock): ${affiliateUrl}`);
      break;

    case 'amazon':
      // TODO: Integrar com Amazon Associates API
      // https://affiliate-program.amazon.com.br/
      affiliateUrl = `${originalUrl}${originalUrl.includes('?') ? '&' : '?'}tag=SEU_TAG_AMAZON`;
      logger.debug(`[Afiliado] Amazon (mock): ${affiliateUrl}`);
      break;

    case 'shopee':
      // TODO: Integrar com Shopee Affiliate API
      affiliateUrl = `${originalUrl}${originalUrl.includes('?') ? '&' : '?'}af_id=SEU_ID_SHOPEE`;
      logger.debug(`[Afiliado] Shopee (mock): ${affiliateUrl}`);
      break;

    case 'magazineluiza':
      // TODO: Integrar com programa de afiliados da Magalu
      affiliateUrl = `${originalUrl}${originalUrl.includes('?') ? '&' : '?'}partner_id=SEU_ID_MAGALU`;
      logger.debug(`[Afiliado] Magazine Luiza (mock): ${affiliateUrl}`);
      break;

    default:
      // Plataforma não reconhecida — repassa o link original
      affiliateUrl = originalUrl;
      logger.warn(`[Afiliado] Plataforma não reconhecida para: ${originalUrl}`);
      break;
  }

  return {
    originalUrl,
    affiliateUrl,
    platform,
  };
}

module.exports = { convertLink, detectPlatform };
