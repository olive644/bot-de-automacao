// ============================================
// Fonte Telegram
// Escuta grupos e canais do Telegram por long polling da Bot API.
//
// O bot só enxerga mensagens de grupo com o modo privacidade desligado
// (@BotFather > /setprivacy > Disable) e precisa ser membro do grupo.
// Em canal, precisa ser administrador.
// ============================================

const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const { extractPromoInfo } = require('../utils/regex');
const { enqueue } = require('./queue');

const API_BASE = 'https://api.telegram.org';
const OFFSET_FILE = path.resolve(__dirname, '../../.telegram_offset.json');
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
// O long polling segura a conexão até haver novidade; o timeout do fetch
// precisa de folga sobre o do Telegram para não abortar antes da resposta.
const LONG_POLL_SECONDS = 30;
const REQUEST_TIMEOUT_MS = (LONG_POLL_SECONDS + 15) * 1000;
const ERROR_BACKOFF_MS = 15000;

let stopped = true;
let offset = 0;
let loopPromise = null;

function apiUrl(method) {
  return `${API_BASE}/bot${config.telegramBotToken}/${method}`;
}

/**
 * Identificadores possíveis de um chat: o id numérico e o @usuario público.
 * Assim o .env aceita as duas formas.
 */
function chatIdentifiers(chat) {
  if (!chat) return [];
  const values = [chat.id, chat.username ? `@${chat.username}` : null];
  return values
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map((value) => String(value).trim().toLowerCase());
}

function normalizeSource(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  // Aceita "@canal", "canal" e o link t.me/canal como a mesma coisa.
  const fromLink = text.match(/^(?:https?:\/\/)?t\.me\/(?:s\/)?([a-z0-9_]+)$/i);
  if (fromLink) return `@${fromLink[1].toLowerCase()}`;
  if (/^-?\d+$/.test(text)) return text;
  return text.startsWith('@') ? text : `@${text}`;
}

function isConfiguredChat(chat, sources = config.telegramSourceChats) {
  const configured = new Set(sources.map(normalizeSource).filter(Boolean));
  if (configured.size === 0) return false;
  return chatIdentifiers(chat).some((id) => configured.has(id));
}

function chatLabel(chat) {
  return chat?.title || (chat?.username ? `@${chat.username}` : String(chat?.id || 'desconhecido'));
}

/**
 * Mensagem de grupo, post de canal e as versões editadas de cada um.
 * A editada entra porque promoção costuma ser corrigida logo depois.
 */
function readPost(update) {
  return update?.message || update?.channel_post || update?.edited_message || update?.edited_channel_post || null;
}

function getPostText(post) {
  const primary = [post?.text, post?.caption].find((value) => typeof value === 'string' && value.trim()) || '';
  return primary.trim();
}

function loadOffset() {
  try {
    if (!fs.existsSync(OFFSET_FILE)) return;
    const data = JSON.parse(fs.readFileSync(OFFSET_FILE, 'utf8'));
    if (Number.isInteger(data?.offset)) offset = data.offset;
  } catch (error) {
    logger.warn('[Telegram] Não foi possível carregar a posição da fila de updates:', error.message);
  }
}

function saveOffset() {
  try {
    fs.writeFileSync(OFFSET_FILE, JSON.stringify({ offset }), 'utf8');
  } catch (error) {
    logger.warn('[Telegram] Não foi possível salvar a posição da fila de updates:', error.message);
  }
}

async function callApi(method, params = {}, timeoutMs = 20000) {
  const url = new URL(apiUrl(method));
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) {
    const detail = payload.description || `HTTP ${response.status}`;
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  return payload.result;
}

/**
 * Baixa a maior foto que caiba no limite e devolve no formato que a fila
 * espera. Falha em imagem nunca impede o envio do texto.
 */
async function downloadPhoto(post) {
  const sizes = Array.isArray(post?.photo) ? post.photo : [];
  const candidate = sizes
    .filter((size) => !size.file_size || size.file_size <= MAX_MEDIA_BYTES)
    .sort((left, right) => (right.file_size || 0) - (left.file_size || 0))[0];
  if (!candidate) return null;

  try {
    const file = await callApi('getFile', { file_id: candidate.file_id });
    if (!file?.file_path) return null;
    const response = await fetch(`${API_BASE}/file/bot${config.telegramBotToken}/${file.file_path}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_MEDIA_BYTES) {
      logger.warn('[Telegram] Imagem maior que 8 MB — enviando somente o texto.');
      return null;
    }
    return {
      mimetype: file.file_path.endsWith('.png') ? 'image/png' : 'image/jpeg',
      data: buffer.toString('base64'),
      filename: 'oferta.jpg',
    };
  } catch (error) {
    logger.warn('[Telegram] Não foi possível baixar a imagem — enviando somente o texto:', error.message);
    return null;
  }
}

async function processPost(post) {
  const text = getPostText(post);
  if (!text) return false;

  const promoInfo = extractPromoInfo(text);
  if (promoInfo.urls.length === 0) {
    logger.debug('[Telegram] Mensagem sem URL — ignorando.');
    return false;
  }

  const origem = chatLabel(post.chat);
  logger.info(`[Telegram] Mensagem recebida em: ${origem}`);
  logger.info(`[Telegram] URL(s) encontrada(s): ${promoInfo.urls.length}`);

  const media = config.telegramSendImages ? await downloadPhoto(post) : null;
  if (media) logger.info('[Telegram] Imagem da promoção capturada.');

  enqueue({
    title: promoInfo.title || 'Confira esta oferta',
    urls: promoInfo.urls,
    prices: promoInfo.prices,
    coupons: promoInfo.coupons,
    couponLines: promoInfo.couponLines,
    originalPrice: promoInfo.originalPrice,
    currentPrice: promoInfo.currentPrice,
    media,
    rawText: promoInfo.rawText,
    sourceGroup: `Telegram: ${origem}`,
    receivedAt: new Date().toISOString(),
  });
  return true;
}

async function handleUpdates(updates) {
  for (const update of updates) {
    // Avança a posição antes de processar: um erro em uma mensagem não pode
    // fazer o bot reprocessar a mesma promoção em todo ciclo.
    offset = Math.max(offset, Number(update.update_id) + 1);
    try {
      const post = readPost(update);
      if (post && isConfiguredChat(post.chat)) await processPost(post);
    } catch (error) {
      logger.error('[Telegram] Erro ao processar mensagem:', error.message);
    }
  }
  if (updates.length > 0) saveOffset();
}

function describeApiError(error) {
  if (error.status === 401) {
    return 'Token recusado. Confira TELEGRAM_BOT_TOKEN com o @BotFather.';
  }
  if (error.status === 409) {
    return 'Outro processo está lendo os updates deste bot, ou há um webhook ativo. '
      + 'Encerre a outra instância ou remova o webhook com o método deleteWebhook.';
  }
  return error.message;
}

async function loop() {
  while (!stopped) {
    try {
      const updates = await callApi('getUpdates', {
        offset,
        timeout: LONG_POLL_SECONDS,
        allowed_updates: JSON.stringify(['message', 'channel_post', 'edited_message', 'edited_channel_post']),
      }, REQUEST_TIMEOUT_MS);
      await handleUpdates(Array.isArray(updates) ? updates : []);
    } catch (error) {
      if (stopped) break;
      // TimeoutError do long polling é esperado quando não chega nada.
      if (error.name === 'TimeoutError' || error.name === 'AbortError') continue;
      logger.warn('[Telegram] Falha ao consultar updates:', describeApiError(error));
      await new Promise((resolve) => setTimeout(resolve, ERROR_BACKOFF_MS));
    }
  }
}

async function startTelegramSource() {
  if (!config.telegramEnabled) {
    logger.info('[Telegram] Fonte desativada (TELEGRAM_ENABLED=false).');
    return;
  }
  if (!config.telegramBotToken) {
    logger.warn('[Telegram] TELEGRAM_ENABLED está ativo, mas TELEGRAM_BOT_TOKEN não foi configurado.');
    return;
  }
  if (config.telegramSourceChats.length === 0) {
    logger.warn('[Telegram] TELEGRAM_ENABLED está ativo, mas TELEGRAM_SOURCE_CHATS está vazio.');
    return;
  }
  if (!stopped) return;

  try {
    const me = await callApi('getMe');
    logger.info(`[Telegram] Conectado como @${me.username}.`);
  } catch (error) {
    logger.warn('[Telegram] Não foi possível conectar:', describeApiError(error));
    return;
  }

  loadOffset();
  stopped = false;
  logger.info(`[Telegram] Escutando ${config.telegramSourceChats.length} fonte(s): ${config.telegramSourceChats.join(', ')}`);
  logger.info('[Telegram] Em grupo, o bot só recebe mensagens com o modo privacidade desligado no @BotFather.');
  loopPromise = loop();
}

function stopTelegramSource() {
  stopped = true;
  loopPromise = null;
  saveOffset();
}

module.exports = {
  chatIdentifiers,
  normalizeSource,
  isConfiguredChat,
  chatLabel,
  readPost,
  getPostText,
  processPost,
  startTelegramSource,
  stopTelegramSource,
};
