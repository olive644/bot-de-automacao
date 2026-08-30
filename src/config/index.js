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
