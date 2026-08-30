// ============================================
// ENTRY POINT — Bot de Promoções WhatsApp
// ============================================
// Orquestra a inicialização de todos os módulos:
//   1. Conecta ao WhatsApp (QR Code no terminal)
//   2. Registra o listener nos grupos fonte
//   3. Inicia o processador de fila
//
// Para rodar:  npm start  ou  node index.js
// ============================================

const config = require('./src/config');
const client = require('./src/services/whatsapp');
const { registerListener } = require('./src/services/listener');
const { startProcessing, stopProcessing, saveBeforeExit } = require('./src/services/queue');
const { configureBotProfile } = require('./src/services/profile');
const { startMercadoLivrePublicSource, stopMercadoLivrePublicSource } = require('./src/services/mercadolivre-public');
const logger = require('./src/utils/logger');

// --- Validação mínima de configuração ---
function validateConfig() {
  if (config.sourceGroups.length === 0 || config.sourceGroups[0] === '') {
    logger.warn('SOURCE_GROUPS não configurado no .env — o bot não vai capturar promoções.');
    logger.warn('Use "npm run list-groups" para descobrir os IDs dos seus grupos.');
  }
  if (!config.destGroup) {
    logger.warn('DEST_GROUP não configurado no .env — o bot não vai enviar promoções.');
  }
  if (config.mercadoLivrePublicEnabled && config.mercadoLivreSearches.length === 0) {
    logger.warn('ML_PUBLIC_ENABLED está ativo, mas ML_PUBLIC_SEARCHES não possui termos para pesquisar.');
  }
}

// --- Quando o client estiver pronto ---
// Usa once() para garantir execução única mesmo que o evento dispare múltiplas vezes
client.once('ready', async () => {
  logger.info('='.repeat(50));
  logger.info('Bot de Promoções iniciado com sucesso!');
  logger.info(`Grupos fonte: ${config.sourceGroups.length}`);
  logger.info(`Grupo destino: ${config.destGroup || 'NÃO CONFIGURADO'}`);
  logger.info('='.repeat(50));

  await configureBotProfile(client);

  // Registra o listener de mensagens
  registerListener(client);

  // Inicia o processador de fila (roda em loop contínuo)
  startProcessing(client);

  // Consulta o catálogo público; não depende de token, OAuth ou conta vendedora.
  startMercadoLivrePublicSource();
});

// --- Graceful shutdown (Ctrl+C) ---
process.on('SIGINT', async () => {
  logger.info('Encerrando bot...');
  stopProcessing();
  stopMercadoLivrePublicSource();
  saveBeforeExit();

  try {
    await client.destroy();
    logger.info('Sessão do WhatsApp encerrada.');
  } catch (err) {
    logger.error('Erro ao encerrar sessão:', err.message);
  }

  process.exit(0);
});

// --- Captura erros não tratados ---
process.on('uncaughtException', (err) => {
  logger.error('Erro não tratado:', err.message);
  logger.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Promise rejeitada:', reason);
});

// --- Inicializa ---
validateConfig();
logger.info('Iniciando conexão com WhatsApp...');
logger.info('Aguardando QR Code...');
client.initialize();
