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
const { startMercadoLivrePublicSource, stopMercadoLivrePublicSource } = require('./src/services/mercadolivre-public');
const { startItadSource, stopItadSource } = require('./src/services/itad');
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
  if (config.destGroup && config.sourceGroups.includes(config.destGroup)) {
    logger.warn('DEST_GROUP também está em SOURCE_GROUPS. Remova-o das fontes para evitar reenvios em loop.');
  }
  if (config.mercadoLivrePublicEnabled && config.mercadoLivreCategories.length === 0) {
    logger.warn('ML_PUBLIC_ENABLED está ativo, mas ML_PUBLIC_CATEGORIES não possui categorias para consultar.');
  }
  if (config.mercadoLivreLegacySearches.length > 0) {
    logger.warn('ML_PUBLIC_SEARCHES não é mais usado: a busca por termo passou a exigir login no Mercado Livre.');
    logger.warn('Troque por ML_PUBLIC_CATEGORIES (categorias das ofertas do dia) e, se quiser filtrar, ML_PUBLIC_KEYWORDS.');
  }
  if (config.itadEnabled && !config.itadApiKey) {
    logger.warn('ITAD_ENABLED está ativo, mas ITAD_API_KEY não foi configurada no .env.');
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

  // Registra o listener imediatamente. O bot nunca altera nome ou foto da
  // conta do WhatsApp conectada.
  registerListener(client);

  // Inicia o processador de fila (roda em loop contínuo)
  startProcessing(client);

  // Consulta o catálogo público; não depende de token, OAuth ou conta vendedora.
  startMercadoLivrePublicSource();
  startItadSource();
});

// --- Graceful shutdown (Ctrl+C) ---
process.on('SIGINT', async () => {
  logger.info('Encerrando bot...');
  stopProcessing();
  stopMercadoLivrePublicSource();
  stopItadSource();
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
