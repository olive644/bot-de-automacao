// ============================================
// Logger simples com timestamps e níveis
// Formato: [HH:MM:SS] [LEVEL] mensagem
// ============================================

const config = require('../config');

// Mapa de prioridade dos níveis de log
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Nível mínimo configurado (tudo abaixo é ignorado)
const currentLevel = LOG_LEVELS[config.logLevel] ?? LOG_LEVELS.INFO;

/**
 * Formata o timestamp atual como HH:MM:SS
 */
function timestamp() {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false });
}

/**
 * Loga mensagem se o nível for >= ao nível configurado.
 *
 * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'} level
 * @param {string} message
 * @param {any} [data] - Dados extras para debug (opcional)
 */
function log(level, message, data) {
  if (LOG_LEVELS[level] < currentLevel) return;

  const prefix = `[${timestamp()}] [${level}]`;

  if (data !== undefined) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

// Atalhos por nível
const logger = {
  debug: (msg, data) => log('DEBUG', msg, data),
  info: (msg, data) => log('INFO', msg, data),
  warn: (msg, data) => log('WARN', msg, data),
  error: (msg, data) => log('ERROR', msg, data),
};

module.exports = logger;
