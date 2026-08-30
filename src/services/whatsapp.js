// ============================================
// Serviço de inicialização do WhatsApp Web
// Gera QR Code no terminal e mantém a sessão
// ============================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Cria e configura o client do WhatsApp Web.
 *
 * - LocalAuth: salva a sessão em .wwebjs_auth/ para não precisar
 *   escanear o QR Code toda vez que reiniciar.
 * - puppeteer.args: flags para rodar headless sem problemas no Windows.
 */
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

// --- Eventos do ciclo de vida ---

// Gera QR Code como imagem PNG para fácil escaneamento
client.on('qr', async (qr) => {
  const qrPath = path.resolve(__dirname, '../../qrcode.png');

  try {
    // Gera PNG grande (400x400) com margem generosa — fácil de escanear
    await qrcode.toFile(qrPath, qr, {
      type: 'png',
      width: 400,
      margin: 3,
      color: { dark: '#000000', light: '#ffffff' },
    });

    logger.info('==================================================');
    logger.info('QR CODE GERADO! Abra o arquivo para escanear:');
    logger.info(`→ ${qrPath}`);
    logger.info('==================================================');

    // Abre automaticamente no Windows
    const { exec } = require('child_process');
    exec(`start "" "${qrPath}"`);
  } catch (err) {
    logger.error('Erro ao gerar QR Code PNG:', err.message);
  }
});

// Sessão autenticada com sucesso
client.on('authenticated', () => {
  logger.info('Autenticação bem-sucedida! Sessão salva localmente.');
});

// Client pronto para uso
client.on('ready', () => {
  logger.info('Bot conectado e pronto para operar!');
});

// Falha na autenticação
client.on('auth_failure', (msg) => {
  logger.error('Falha na autenticação:', msg);
});

// Desconexão
client.on('disconnected', (reason) => {
  logger.warn('Bot desconectado:', reason);
});

module.exports = client;
