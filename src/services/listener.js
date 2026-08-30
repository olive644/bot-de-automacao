// ============================================
// Listener de mensagens dos grupos fonte
// Filtra, extrai dados e enfileira promoções
// ============================================

const config = require('../config');
const logger = require('../utils/logger');
const { extractPromoInfo } = require('../utils/regex');
const { normalizeChatId } = require('../utils/chat-id');
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
 * Extrai a promoção, preserva os links originais e enfileira.
 */
function getMessageText(message) {
  const candidates = [message?.body, message?._data?.caption, message?._data?.body];
  const primary = candidates.find((value) => typeof value === 'string' && value.trim()) || '';
  const links = Array.isArray(message?.links)
    ? message.links
      .map((entry) => typeof entry === 'string' ? entry : entry?.link || entry?.href || entry?.url)
      .filter((url) => typeof url === 'string' && url.trim() && !primary.includes(url))
    : [];
  return [primary.trim(), ...links].filter(Boolean).join('\n');
}

function resolveConfiguredSource(message, sourceGroups = config.sourceGroups) {
  const configured = new Set(sourceGroups
    .map(normalizeChatId)
    .filter((id) => id && id !== config.destGroup));
  const candidates = [message?.from, message?.to].map(normalizeChatId).filter(Boolean);
  return candidates.find((id) => configured.has(id)) || '';
}

async function processMessage(message, sourceName, sourceId, text) {
  const promoInfo = extractPromoInfo(text);

  if (promoInfo.urls.length === 0) {
    logger.debug('[Listener] Mensagem sem URL — ignorando.');
    return;
  }

  // Detecta duplicata
  const messageHash = hashMessage(text, sourceId);
  if (isDuplicate(messageHash)) {
    logger.debug('[Listener] ⚠️  Mensagem duplicada detectada — ignorando.');
    return;
  }

  // Marca antes de qualquer await para impedir duplicação quando os eventos
  // `message` e `message_create` chegarem quase ao mesmo tempo.
  markAsProcessed(messageHash);

  logger.info(`[Listener] URL(s) encontrada(s): ${promoInfo.urls.length}`);

  let media = null;
  if (message.hasMedia) {
    try {
      const downloaded = await message.downloadMedia();
      if (downloaded?.mimetype?.startsWith('image/')) {
        const size = Buffer.byteLength(downloaded.data, 'base64');
        if (size <= 8 * 1024 * 1024) {
          media = {
            mimetype: downloaded.mimetype,
            data: downloaded.data,
            filename: downloaded.filename || 'oferta.jpg',
          };
          logger.info('[Listener] Imagem da promoção capturada.');
        } else {
          logger.warn('[Listener] Imagem maior que 8 MB — enviando somente o texto.');
        }
      }
    } catch (error) {
      logger.warn('[Listener] Não foi possível baixar a imagem — enviando somente o texto:', error.message);
    }
  }

  const promo = {
    title: promoInfo.title || 'Confira esta oferta',
    urls: promoInfo.urls,
    prices: promoInfo.prices,
    coupons: promoInfo.coupons,
    couponLines: promoInfo.couponLines,
    originalPrice: promoInfo.originalPrice,
    currentPrice: promoInfo.currentPrice,
    media,
    rawText: promoInfo.rawText,
    sourceGroup: sourceName,
    receivedAt: new Date().toISOString(),
  };

  enqueue(promo);
}

async function verifyConfiguredSources(client) {
  if (config.sourceGroups.length === 0 || typeof client.getChats !== 'function') return;
  try {
    const chats = await client.getChats();
    const known = new Map(chats.map((chat) => [normalizeChatId(chat?.id), chat]));
    for (const sourceId of config.sourceGroups) {
      const chat = known.get(sourceId);
      if (chat) {
        logger.info(`[Listener] Fonte reconhecida: ${chat.name || sourceId} (${sourceId})`);
      } else {
        logger.warn(`[Listener] Fonte não encontrada nesta sessão: ${sourceId}. Confirme com npm run list-groups.`);
      }
    }
  } catch (error) {
    logger.warn('[Listener] Não foi possível conferir os grupos configurados:', error.message);
  }
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
  const handleMessage = async (message) => {
    try {
      const sourceId = resolveConfiguredSource(message);
      if (!sourceId) return;

      const isChannel = sourceId.endsWith('@newsletter');
      const isGroup = sourceId.endsWith('@g.us');

      if (!isGroup && !isChannel) return;

      const text = getMessageText(message);
      if (!text) {
        logger.debug('[Listener] Mensagem sem texto — ignorando.');
        return;
      }

      // Tenta obter o nome do chat para o log (não crítico)
      let sourceName = sourceId;
      try {
        const chat = await message.getChat();
        sourceName = chat.name || sourceId;
      } catch (_) {
        // Se falhar, usa o ID como fallback — não interrompe o fluxo
      }

      logger.info(`[Listener] Mensagem recebida em: ${sourceName} (${isChannel ? 'canal' : 'grupo'})`);
      logger.debug(`[Listener] Conteúdo: ${text}`);

      await processMessage(message, sourceName, sourceId, text);
    } catch (error) {
      logger.error('[Listener] Erro ao processar mensagem:', error.message);
    }
  };

  // Algumas versões do WhatsApp Web entregam canais/grupos somente em um dos
  // eventos. Escutar ambos aumenta a compatibilidade; o hash evita duplicatas.
  client.on('message', handleMessage);
  client.on('message_create', handleMessage);

  logger.info(`[Listener] Escutando ${config.sourceGroups.length} fonte(s) configurada(s).`);
  config.sourceGroups.forEach((sourceId, index) => logger.info(`[Listener] Fonte ${index + 1}: ${sourceId}`));
  verifyConfiguredSources(client);
}

module.exports = { registerListener, getMessageText, resolveConfiguredSource, processMessage };
