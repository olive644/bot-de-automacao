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

const config = {
  // IDs dos grupos fonte (de onde capturamos promoções)
  sourceGroups: process.env.SOURCE_GROUPS
    ? process.env.SOURCE_GROUPS.split(',').map(normalizeChatId).filter(Boolean)
    : [],

  // ID do grupo destino (para onde enviamos as promoções convertidas)
  destGroup: normalizeChatId(process.env.DEST_GROUP),

  // Catálogo público do Mercado Livre — não requer OAuth ou tokens.
  mercadoLivrePublicEnabled: process.env.ML_PUBLIC_ENABLED === 'true',
  mercadoLivreSearches: process.env.ML_PUBLIC_SEARCHES
    ? process.env.ML_PUBLIC_SEARCHES.split(',').map((query) => query.trim()).filter(Boolean)
    : [],
  mercadoLivrePollMinutes: Math.max(15, parseInt(process.env.ML_PUBLIC_POLL_MINUTES, 10) || 60),
  mercadoLivreMinDiscount: Math.min(95, Math.max(1, parseInt(process.env.ML_PUBLIC_MIN_DISCOUNT, 10) || 20)),
  mercadoLivreMaxResults: Math.min(10, Math.max(1, parseInt(process.env.ML_PUBLIC_MAX_RESULTS, 10) || 3)),
  mercadoLivreMaxPerSearch: Math.min(3, Math.max(1, parseInt(process.env.ML_PUBLIC_MAX_PER_SEARCH, 10) || 1)),
  // A API pública costuma responder 403 para aplicações sem política de
  // catálogo. Por isso o navegador público é o modo padrão; só é desligado
  // quando a variável for explicitamente `false`.
  mercadoLivreWebFallbackEnabled: process.env.ML_WEB_FALLBACK_ENABLED !== 'false',
  // API gerenciada opcional para quando o Mercado Livre bloquear API e página.
  // A chave deve ficar somente no .env local.
  mercadoLivreParseApiKey: process.env.ML_PARSE_API_KEY || process.env.PARSE_API_KEY || '',
  // Fallback opcional para bloqueios 401/403 do catálogo público.
  mercadoLivreClientId: process.env.ML_CLIENT_ID || '',
  mercadoLivreClientSecret: process.env.ML_CLIENT_SECRET || '',

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
