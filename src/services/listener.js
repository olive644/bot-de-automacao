// ============================================
// Listener de mensagens dos grupos fonte
// Filtra, extrai dados e enfileira promoções
// ============================================

const config = require('../config');
const logger = require('../utils/logger');
const { extractPromoInfo } = require('../utils/regex');
const { convertLink } = require('./affiliate');
const { enqueue } = require('./queue');

// Rastrear hashes de mensagens já processadas (últimos 30 min) — evitar duplicatas
const processedHashes = new Map();
const HASH_RETENTION_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Gera um hash simples da mensagem para detectar duplicatas
 */
function hashMessage(text, fromId) {
  const content = `${text}|${fromId}`;
  return require('crypto').createHash('md5').update(content).digest('hex');
}

/**
 * Verifica se uma mensagem foi processada recentemente
 */
function isDuplicate(messageHash) {
  const now = Date.now();

  // Limpa hashes antigos (performance)
  for (const [hash, timestamp] of processedHashes.entries()) {
    if (now - timestamp > HASH_RETENTION_MS) {
      processedHashes.delete(hash);
    }
  }

  return processedHashes.has(messageHash);
}

/**
 * Marca mensagem como processada
 */
function markAsProcessed(messageHash) {
  processedHashes.set(messageHash, Date.now());
}

/**
 * Processa uma mensagem recebida (de grupo ou canal).
 * Extrai promoção, converte link e enfileira.
 */
async function processMessage(message, sourceName) {
  const promoInfo = extractPromoInfo(message.body);

  if (promoInfo.urls.length === 0) {
    logger.debug('[Listener] Mensagem sem URL — ignorando.');
    return;
  }

  // Detecta duplicata
  const messageHash = hashMessage(message.body, message.from);
  if (isDuplicate(messageHash)) {
    logger.debug('[Listener] ⚠️  Mensagem duplicada detectada — ignorando.');
    return;
  }

  logger.info(`[Listener] URL(s) encontrada(s): ${promoInfo.urls.length}`);

  const mainUrl = promoInfo.urls[0];
  const converted = convertLink(mainUrl);

  const promo = {
    title: promoInfo.title || `Link ${converted.platform}`,
    affiliateUrl: converted.affiliateUrl,
    platform: converted.platform,
    prices: promoInfo.prices,
    rawText: promoInfo.rawText,
    sourceGroup: sourceName,
    receivedAt: new Date().toISOString(),
  };

  markAsProcessed(messageHash);
  enqueue(promo);
}

/**
 * Registra o listener de mensagens no client do WhatsApp.
 *
 * Suporta dois tipos de fonte:
 *   - Grupos normais  (ID termina em @g.us)
 *   - Canais WhatsApp (ID termina em @newsletter — aba Atualizações)
 *
 * @param {import('whatsapp-web.js').Client} client - Client do WhatsApp
 */
function registerListener(client) {
  // --- Listener para grupos e canais ---
  client.on('message', async (message) => {
    try {
      // Mensagens de canal chegam com from terminando em @newsletter
      // Evita chamar getChat() que pode falhar em alguns tipos de mensagem
      const fromId = message.from || '';
      const isChannel = fromId.endsWith('@newsletter');
      const isGroup = fromId.endsWith('@g.us');

      if (!isGroup && !isChannel) return;

      // Verifica se está na lista de fontes configuradas
      if (!config.sourceGroups.includes(fromId)) return;

      // Ignora mensagens sem texto (imagens sem legenda, stickers, etc.)
      if (!message.body || message.body.trim() === '') {
        logger.debug('[Listener] Mensagem sem texto — ignorando.');
        return;
      }

      // Tenta obter o nome do chat para o log (não crítico)
      let sourceName = fromId;
      try {
        const chat = await message.getChat();
        sourceName = chat.name || fromId;
      } catch (_) {
        // Se falhar, usa o ID como fallback — não interrompe o fluxo
      }

      logger.info(`[Listener] Mensagem recebida em: ${sourceName} (${isChannel ? 'canal' : 'grupo'})`);
      logger.debug(`[Listener] Conteúdo: ${message.body}`);

      await processMessage(message, sourceName);
    } catch (error) {
      logger.error('[Listener] Erro ao processar mensagem:', error.message);
    }
  });

  logger.info(`[Listener] Escutando ${config.sourceGroups.length} fonte(s) configurada(s).`);
}

module.exports = { registerListener };
