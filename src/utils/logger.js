// ============================================
// Logger simples com timestamps e níveis
// Formato: [HH:MM:SS] [LEVEL] mensagem
// ============================================

const fs = require('fs');
const path = require('path');
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

// Com LOG_FILE definido, tudo que sai no console sai também no arquivo. É o
// que permite acompanhar o bot depois, quando ele sobe sozinho pelo
// Agendador de Tarefas e ninguém está olhando a janela.
const logFile = process.env.LOG_FILE
  ? path.resolve(__dirname, '../../', process.env.LOG_FILE)
  : null;
let logStream = null;

if (logFile) {
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    logStream = fs.createWriteStream(logFile, { flags: 'a' });
    // Um arquivo de log indisponível nunca pode derrubar o bot.
    logStream.on('error', () => { logStream = null; });
  } catch (_) {
    logStream = null;
  }
}

function writeToFile(line) {
  if (!logStream) return;
  try {
    logStream.write(`${line}\n`);
  } catch (_) {
    logStream = null;
  }
}

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
    writeToFile(`${prefix} ${message} ${safeStringify(data)}`);
  } else {
    console.log(`${prefix} ${message}`);
    writeToFile(`${prefix} ${message}`);
  }
}

function safeStringify(data) {
  if (typeof data === 'string') return data;
  // JSON.stringify de um Error devolve "{}" e joga fora justamente a
  // mensagem e o stack, que sao a unica coisa util quando algo quebra.
  if (data instanceof Error) return data.stack || `${data.name}: ${data.message}`;
  try {
    const json = JSON.stringify(data);
    return json === undefined ? String(data) : json;
  } catch (_) {
    return String(data);
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
