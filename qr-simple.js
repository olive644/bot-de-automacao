#!/usr/bin/env node

/**
 * Gera um fake QR Code para demonstração
 * Usa a sessão já autenticada se existir
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

let attemps = 0;
const MAX_ATTEMPTS = 30;

// --- Tentar usar sessão existente ou gerar novo QR ---
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
  },
});

client.on('qr', async (qr) => {
  logger.info('');
  logger.info('='.repeat(70));
  logger.info('🎯 GERANDO QR CODE...');
  logger.info('='.repeat(70));

  try {
    const qrPath = path.join(__dirname, 'qr-code.png');

    await QRCode.toFile(qrPath, qr, {
      width: 1000,
      margin: 20,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    logger.info('✅ QR Code salvo: qr-code.png');

    // Exibir como ASCII também
    const ascii = require('qrcode-terminal');
    logger.info('');
    logger.info('📱 Escaneie este QR Code com o celular:');
    logger.info('');
    ascii.generate(qr, { small: false }, (code) => {
      console.log(code);
    });

    logger.info('');
    logger.info('📋 Instruções:');
    logger.info('  1. Pegue o celular com +1(832)7076644');
    logger.info('  2. Abra WhatsApp');
    logger.info('  3. Vá em: Configurações → Aparelhos conectados → Conectar aparelho');
    logger.info('  4. Aponte para o QR Code acima');
    logger.info('  5. Confirme no celular');
    logger.info('');
    logger.info('⏱️  QR Code expira em ~1 minuto');
    logger.info('');

  } catch (error) {
    logger.error('Erro ao gerar QR:', error.message);
  }
});

client.on('authenticated', () => {
  logger.info('');
  logger.info('✅ AUTENTICAÇÃO BEM-SUCEDIDA!');
  logger.info('');
  setTimeout(() => {
    logger.info('🤖 Iniciando bot em 3 segundos...');
    setTimeout(startMainBot, 3000);
  }, 1000);
});

client.on('ready', () => {
  logger.info('✅ Bot conectado e pronto!');
});

client.on('auth_failure', (msg) => {
  logger.error('❌ Falha:', msg);
});

client.on('disconnected', (reason) => {
  logger.warn('⚠️  Desconectado:', reason);
});

// --- Iniciar com retry ---
function tryConnect() {
  attemps++;
  if (attemps > MAX_ATTEMPTS) {
    logger.error('Falha ao conectar após múltiplas tentativas.');
    process.exit(1);
  }

  try {
    client.initialize();
  } catch (error) {
    if (attemps < MAX_ATTEMPTS) {
      logger.warn(`Tentativa ${attemps}/${MAX_ATTEMPTS} - Aguardando...`);
      setTimeout(tryConnect, 2000);
    }
  }
}

logger.info('Conectando ao WhatsApp...');
tryConnect();

// --- Bot Principal ---
function startMainBot() {
  logger.info('Iniciando bot principal...');

  const config = require('./src/config');
  const { registerListener } = require('./src/services/listener');
  const { startProcessing, stopProcessing, saveBeforeExit } = require('./src/services/queue');

  if (config.sourceGroups.length === 0 || !config.destGroup) {
    logger.warn('');
    logger.warn('⚠️  CONFIGURAÇÃO INCOMPLETA!');
    logger.warn('Configure: npm run list-groups');
    logger.warn('Edite .env com SOURCE_GROUPS e DEST_GROUP');
    logger.warn('');
    return;
  }

  registerListener(client);
  startProcessing(client);

  logger.info('');
  logger.info('='.repeat(70));
  logger.info('✅ BOT INICIADO COM SUCESSO!');
  logger.info('='.repeat(70));
  logger.info('');

  process.on('SIGINT', async () => {
    logger.info('Encerrando...');
    stopProcessing();
    saveBeforeExit();
    try {
      await client.destroy();
    } catch (err) {
      logger.error('Erro:', err.message);
    }
    process.exit(0);
  });
}
