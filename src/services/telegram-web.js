// ============================================
// Canais públicos do Telegram, pela prévia web
//
// Canal público tem uma página em t.me/s/<canal> que o próprio Telegram
// serve já renderizada, com as mensagens recentes. Ler dali dispensa bot
// dentro do canal, permissão de administrador e login — que é o caso de
// quem acompanha canais de promoção sem ser dono deles.
//
// Só vale para canal público com @usuario. Grupo privado, com link de
// convite, não tem prévia web e fica fora do alcance.
// ============================================

const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const { extractPromoInfo } = require('../utils/regex');
const { enqueue } = require('./queue');
const { recordCycle } = require('./health');

const PREVIEW_URL = 'https://t.me/s/{canal}';
const POST_URL = 'https://t.me/{canal}/{id}';
const SEEN_FILE = path.resolve(__dirname, '../../.telegram_web_seen.json');
const MAX_SEEN_ITEMS = 5000;
const REQUEST_TIMEOUT_MS = 30000;
const DELAY_BETWEEN_CHANNELS_MS = 1500;
const REQUEST_HEADERS = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

let timer = null;
let running = false;
let seen = new Map();

/**
 * Aceita "@canal", "canal" e o link t.me/canal como a mesma coisa.
 */
function normalizeChannel(value) {
  const texto = String(value || '').trim();
  if (!texto) return '';
  const doLink = texto.match(/^(?:https?:\/\/)?t\.me\/(?:s\/)?([a-z0-9_]+)\/?$/i);
  if (doLink) return doLink[1];
  return texto.replace(/^@/, '').replace(/\/+$/, '');
}

/**
 * O Telegram escapa o cifrão como &#036; na prévia. Sem desfazer isso, o
 * "R$ 30" da mensagem nunca casa com o padrão de preço e a promoção sairia
 * sem valor nenhum — falha silenciosa, porque o texto continua legível.
 */
function decodeEntities(text) {
  return String(text || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    // &amp; por último: antes dele, "&amp;#036;" viraria "$" cedo demais.
    .replace(/&amp;/g, '&');
}

function stripTags(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|p)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
}

/**
 * Recorta as mensagens da página de prévia.
 * Cada bloco traz `data-post="canal/123"`, que serve de identidade estável
 * para não repostar o que já saiu.
 */
function parseMessages(html, channel) {
  const mensagens = [];
  const blocos = String(html || '').split('js-widget_message_wrap');

  for (const bloco of blocos.slice(1)) {
    const post = bloco.match(/data-post="([^"]+)"/);
    if (!post) continue;

    const texto = bloco.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const conteudo = texto ? decodeEntities(stripTags(texto[1])).trim() : '';
    if (!conteudo) continue;

    const foto = bloco.match(/tgme_widget_message_photo_wrap[^"]*"[^>]*style="[^"]*background-image:url\('([^']+)'\)/);
    const id = post[1].split('/')[1] || '';

    mensagens.push({
      id: post[1],
      channel,
      permalink: POST_URL.replace('{canal}', channel).replace('{id}', id),
      text: conteudo,
      imageUrl: foto ? foto[1] : null,
    });
  }

  return mensagens;
}

/**
 * Canal de promoção assina quase todo post com o link dos próprios grupos
 * ("🔗 Grupos de ofertas: beacons.ai/..."). Esse link não é a oferta, e
 * repassá-lo em toda mensagem só polui o grupo de destino e manda gente
 * para fora dele. O link do produto é preservado como sempre.
 */
function isDivulgationLink(url) {
  const lista = config.promoLinkBlocklist;
  if (lista.length === 0) return false;
  const texto = String(url || '').toLowerCase();
  return lista.some((dominio) => texto.includes(String(dominio).toLowerCase()));
}

function toPromo(message, channelTitle) {
  const info = extractPromoInfo(message.text);
  const urls = info.urls.filter((url) => !isDivulgationLink(url));
  // Sem link de produto não há oferta — mesmo que o post tivesse links.
  if (urls.length === 0) return null;

  return {
    id: message.id,
    title: info.title || 'Confira esta oferta',
    urls,
    prices: info.prices,
    coupons: info.coupons,
    couponLines: info.couponLines,
    originalPrice: info.originalPrice,
    currentPrice: info.currentPrice,
    media: null,
    imageUrl: message.imageUrl,
    rawText: info.rawText,
    sourceGroup: `Telegram: ${channelTitle || '@' + message.channel}`,
    receivedAt: new Date().toISOString(),
  };
}

function readChannelTitle(html) {
  const titulo = String(html || '').match(/<div class="tgme_channel_info_header_title"[^>]*>\s*<span[^>]*>([^<]+)/);
  return titulo ? decodeEntities(titulo[1]).trim() : '';
}

function loadSeen() {
  try {
    if (!fs.existsSync(SEEN_FILE)) return;
    const data = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'));
    if (Array.isArray(data)) seen = new Map(data.filter((e) => Array.isArray(e) && e.length === 2));
  } catch (error) {
    logger.warn('[Telegram web] Não foi possível carregar posts já enviados:', error.message);
  }
}

function saveSeen() {
  try {
    fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen.entries()].slice(-MAX_SEEN_ITEMS)), 'utf8');
  } catch (error) {
    logger.warn('[Telegram web] Não foi possível salvar posts já enviados:', error.message);
  }
}

async function fetchChannel(channel) {
  const response = await fetch(PREVIEW_URL.replace('{canal}', channel), {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`A prévia respondeu ${response.status} ${response.statusText}.`);
  }
  const html = await response.text();
  const messages = parseMessages(html, channel);
  if (messages.length === 0) {
    throw new Error('Nenhuma mensagem na prévia. O canal pode ser privado, ter mudado de nome ou não existir.');
  }
  return { messages, title: readChannelTitle(html) };
}

async function poll() {
  if (running || !config.telegramWebEnabled || config.telegramWebChannels.length === 0) return;
  running = true;

  try {
    let added = 0;
    let inspected = 0;

    for (const [index, bruto] of config.telegramWebChannels.entries()) {
      const channel = normalizeChannel(bruto);
      if (!channel) continue;
      if (index > 0) await new Promise((r) => setTimeout(r, DELAY_BETWEEN_CHANNELS_MS));

      let dados;
      try {
        dados = await fetchChannel(channel);
      } catch (error) {
        logger.warn(`[Telegram web] Falha ao ler @${channel}:`, error.message);
        recordCycle('Telegram web', { error: error.message });
        continue;
      }

      inspected += dados.messages.length;
      const novas = dados.messages.filter((m) => !seen.has(m.id));

      // Tudo que foi lido vira "visto", mesmo o que não for publicado. Sem
      // isso, a primeira execução despejaria as 20 mensagens da página de
      // cada canal na fila de uma vez.
      for (const mensagem of dados.messages) seen.set(mensagem.id, Date.now());

      // As mais recentes ficam no fim da página; publicamos essas.
      const candidatas = novas.slice(-config.telegramWebMaxPerChannel);
      for (const mensagem of candidatas) {
        const promo = toPromo(mensagem, dados.title);
        if (!promo) continue;
        enqueue(promo);
        added += 1;
        logger.info(`[Telegram web] Oferta de @${channel}: ${promo.title.slice(0, 70)}`);
      }
    }

    saveSeen();
    recordCycle('Telegram web', { read: inspected, added });
    logger.info(`[Telegram web] Consulta concluída: ${inspected} post(s) lido(s), ${added} nova(s) oferta(s).`);
  } catch (error) {
    logger.warn('[Telegram web] Falha na consulta:', error.message);
  } finally {
    running = false;
  }
}

function startTelegramWebSource() {
  if (!config.telegramWebEnabled) {
    logger.info('[Telegram web] Canais públicos desativados (TELEGRAM_WEB_ENABLED=false).');
    return;
  }
  if (config.telegramWebChannels.length === 0) {
    logger.warn('[Telegram web] TELEGRAM_WEB_ENABLED está ativo, mas TELEGRAM_WEB_CHANNELS está vazio.');
    return;
  }
  if (timer) return;

  loadSeen();
  const lista = config.telegramWebChannels.map(normalizeChannel).filter(Boolean).map((c) => '@' + c);
  logger.info(`[Telegram web] Canais públicos ativos: ${lista.join(', ')} — a cada ${config.telegramWebPollMinutes} min.`);
  poll();
  timer = setInterval(poll, config.telegramWebPollMinutes * 60 * 1000);
}

function stopTelegramWebSource() {
  if (timer) clearInterval(timer);
  timer = null;
  saveSeen();
}

module.exports = {
  normalizeChannel,
  decodeEntities,
  stripTags,
  parseMessages,
  toPromo,
  readChannelTitle,
  startTelegramWebSource,
  stopTelegramWebSource,
};
