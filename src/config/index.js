// ============================================
// Configuração central do bot
// Carrega variáveis do .env e exporta constantes
// ============================================

const path = require('path');
const { normalizeChatId } = require('../utils/chat-id');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function parseNumberList(value, fallback) {
  const values = (value || fallback).split(',')
    .map((item) => Number(item.trim()))
    .filter(Number.isInteger);
  return [...new Set(values)];
}

function parseNonNegativeInteger(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) ? Math.max(0, parsed) : fallback;
}

function parseTextList(value, fallback = '') {
  const values = (value === undefined || value === null ? fallback : value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(values)];
}

const config = {
  // IDs dos grupos fonte (de onde capturamos promoções)
  sourceGroups: process.env.SOURCE_GROUPS
    ? process.env.SOURCE_GROUPS.split(',').map(normalizeChatId).filter(Boolean)
    : [],

  // ID do grupo destino (para onde enviamos as promoções convertidas)
  destGroup: normalizeChatId(process.env.DEST_GROUP),

  // Envia a foto do produto junto com a promoção dos coletores. A imagem é
  // baixada na hora do envio, não na coleta.
  sendProductImages: process.env.SEND_PRODUCT_IMAGES !== 'false',

  // Marca d'água aplicada em toda imagem que vai para o grupo de destino,
  // venha ela dos coletores ou dos grupos de origem.
  watermarkEnabled: process.env.WATERMARK_ENABLED !== 'false',
  watermarkText: process.env.WATERMARK_TEXT || 'OliBot',
  // Simbolo do Oli ao lado do texto. Vazio deixa a marca so com o texto.
  watermarkLogo: process.env.WATERMARK_LOGO === ''
    ? null
    : path.resolve(__dirname, '../../', process.env.WATERMARK_LOGO || 'assets/oli-logo.png'),
  watermarkQuality: Math.min(100, Math.max(40, parseInt(process.env.WATERMARK_QUALITY, 10) || 85)),

  // Histórico de preço: só publica oferta que chegue perto do menor valor
  // que o bot já viu, em vez de confiar no "de:" anunciado pela plataforma.
  priceHistoryEnabled: process.env.PRICE_HISTORY_ENABLED !== 'false',
  // Margem sobre o menor preço já visto, em porcentagem.
  priceHistoryTolerance: Math.min(100, Math.max(0, parseInt(process.env.PRICE_HISTORY_TOLERANCE, 10) || 5)),

  // Autodiagnóstico: avisa quando uma fonte ligada para de entregar.
  healthReportEnabled: process.env.HEALTH_REPORT_ENABLED !== 'false',
  healthReportHours: Math.min(72, Math.max(1, parseInt(process.env.HEALTH_REPORT_HOURS, 10) || 6)),
  healthWindowHours: Math.min(168, Math.max(1, parseInt(process.env.HEALTH_WINDOW_HOURS, 10) || 24)),

  // Telegram como fonte adicional, via bot criado no @BotFather.
  telegramEnabled: process.env.TELEGRAM_ENABLED === 'true',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  // Aceita id numérico (-1001234567890) e @usuario de canal/grupo público.
  telegramSourceChats: parseTextList(process.env.TELEGRAM_SOURCE_CHATS),
  telegramSendImages: process.env.TELEGRAM_SEND_IMAGES !== 'false',

  // Canais públicos do Telegram lidos pela prévia web de t.me/s/<canal>.
  // Não exige bot dentro do canal nem permissão de administrador — serve
  // para quem só acompanha canais de promoção sem ser dono deles.
  telegramWebEnabled: process.env.TELEGRAM_WEB_ENABLED === 'true',
  telegramWebChannels: parseTextList(process.env.TELEGRAM_WEB_CHANNELS),
  // Padrões contidos de propósito. A fila envia uma promoção a cada 2 a 5
  // minutos, ou seja, escoa perto de 17 por hora. Três canais a cada 15
  // minutos, com 2 posts cada, produziriam 24 por hora só de Telegram — a
  // fila cresceria sem parar e as ofertas chegariam velhas ao grupo.
  telegramWebPollMinutes: Math.max(5, parseInt(process.env.TELEGRAM_WEB_POLL_MINUTES, 10) || 30),
  telegramWebMaxPerChannel: Math.min(10, Math.max(1, parseInt(process.env.TELEGRAM_WEB_MAX_PER_CHANNEL, 10) || 1)),
  // Domínios de divulgação que canais assinam em quase todo post. Não são a
  // oferta, e repassá-los manda gente para fora do grupo de destino.
  promoLinkBlocklist: parseTextList(
    process.env.PROMO_LINK_BLOCKLIST,
    'beacons.ai,linktr.ee,linktree.com,chat.whatsapp.com,t.me/joinchat'
  ),

  // Ofertas do Dia do Mercado Livre — não requer OAuth, token ou navegador.
  mercadoLivrePublicEnabled: process.env.ML_PUBLIC_ENABLED === 'true',
  // IDs de categoria do feed de ofertas. Games e Informática por padrão.
  mercadoLivreCategories: parseTextList(process.env.ML_PUBLIC_CATEGORIES, 'MLB1144,MLB1648'),
  // Filtro opcional por título. Lista vazia aceita toda oferta da categoria.
  mercadoLivreKeywords: parseTextList(process.env.ML_PUBLIC_KEYWORDS),
  mercadoLivrePages: Math.min(5, Math.max(1, parseInt(process.env.ML_PUBLIC_PAGES, 10) || 2)),
  mercadoLivrePollMinutes: Math.max(15, parseInt(process.env.ML_PUBLIC_POLL_MINUTES, 10) || 60),
  mercadoLivreMinDiscount: Math.min(95, Math.max(1, parseInt(process.env.ML_PUBLIC_MIN_DISCOUNT, 10) || 20)),
  mercadoLivreMaxResults: Math.min(10, Math.max(1, parseInt(process.env.ML_PUBLIC_MAX_RESULTS, 10) || 3)),
  mercadoLivreMaxPerCategory: Math.min(5, Math.max(1, parseInt(process.env.ML_PUBLIC_MAX_PER_CATEGORY, 10) || 1)),
  // Só para avisar quem ainda tem a variável antiga no .env: a busca por
  // termo exige login no Mercado Livre e por isso deixou de ser usada.
  mercadoLivreLegacySearches: parseTextList(process.env.ML_PUBLIC_SEARCHES),

  // AliExpress — busca pública por palavra, sem chave nem navegador.
  aliexpressEnabled: process.env.ALIEXPRESS_ENABLED === 'true',
  aliexpressSearches: parseTextList(process.env.ALIEXPRESS_SEARCHES),
  aliexpressPollMinutes: Math.max(15, parseInt(process.env.ALIEXPRESS_POLL_MINUTES, 10) || 60),
  aliexpressMinDiscount: Math.min(95, Math.max(1, parseInt(process.env.ALIEXPRESS_MIN_DISCOUNT, 10) || 30)),
  aliexpressMaxResults: Math.min(10, Math.max(1, parseInt(process.env.ALIEXPRESS_MAX_RESULTS, 10) || 3)),
  aliexpressMaxPerSearch: Math.min(5, Math.max(1, parseInt(process.env.ALIEXPRESS_MAX_PER_SEARCH, 10) || 1)),

  // IsThereAnyDeal (ITAD) — promoções de jogos de PC.
  itadEnabled: process.env.ITAD_ENABLED === 'true',
  itadApiKey: process.env.ITAD_API_KEY || process.env.IS_THERE_ANY_DEAL_API_KEY || '',
  itadCountry: (process.env.ITAD_COUNTRY || 'BR').toUpperCase(),
  itadPollMinutes: Math.max(15, parseInt(process.env.ITAD_POLL_MINUTES, 10) || 60),
  itadMinDiscount: Math.min(100, Math.max(1, parseInt(process.env.ITAD_MIN_DISCOUNT, 10) || 1)),
  // Evita que a lista seja dominada por jogos obscuros com descontos enormes.
  // Use 0 no .env para aceitar também jogos sem avaliações na Steam.
  itadMinSteamReviews: parseNonNegativeInteger(process.env.ITAD_MIN_STEAM_REVIEWS, 100),
  itadMaxResults: Math.min(10, Math.max(1, parseInt(process.env.ITAD_MAX_RESULTS, 10) || 3)),
  // Steam=61, Epic=16, GOG=35, Nuuvem=50.
  itadShops: parseNumberList(process.env.ITAD_SHOPS, '61,16,35,50'),
  itadPrimaryShops: parseNumberList(process.env.ITAD_PRIMARY_SHOPS, '61,16'),
  itadExcludeBundles: process.env.ITAD_EXCLUDE_BUNDLES !== 'false',
  itadExcludeArabicTitles: process.env.ITAD_EXCLUDE_ARABIC_TITLES !== 'false',

  // Delays entre mensagens na fila (anti-banimento)
  queueDelayMin: parseInt(process.env.QUEUE_DELAY_MIN, 10) || 120000,  // 2 min
  queueDelayMax: parseInt(process.env.QUEUE_DELAY_MAX, 10) || 300000,  // 5 min

  // Delays de simulação de "digitando..." (anti-banimento)
  typingDelayMin: parseInt(process.env.TYPING_DELAY_MIN, 10) || 3000,  // 3 seg
  typingDelayMax: parseInt(process.env.TYPING_DELAY_MAX, 10) || 8000,  // 8 seg

  // Intervalo de verificação da fila quando vazia
  queueCheckInterval: parseInt(process.env.QUEUE_CHECK_INTERVAL, 10) || 30000, // 30 seg

  // Nível de log
  logLevel: process.env.LOG_LEVEL || 'INFO',
};

module.exports = config;
