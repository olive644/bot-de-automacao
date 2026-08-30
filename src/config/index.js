// ============================================
// Configuração central do bot
// Carrega variáveis do .env e exporta constantes
// ============================================

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  // IDs dos grupos fonte (de onde capturamos promoções)
  sourceGroups: process.env.SOURCE_GROUPS
    ? process.env.SOURCE_GROUPS.split(',').map((id) => id.trim())
    : [],

  // ID do grupo destino (para onde enviamos as promoções convertidas)
  destGroup: process.env.DEST_GROUP || '',

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
