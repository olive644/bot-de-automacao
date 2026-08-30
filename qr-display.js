#!/usr/bin/env node

/**
 * Gera e exibe QR Code em PNG + Abre no Explorer/Navegador
 * Sem tentar conectar ao WhatsApp
 */

const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('./src/utils/logger');

// QR Code fake para demonstração
// Em produção, isso viria do whatsapp-web.js
const fakeQRCode = '2@OOz3lIy4LxU0D2zFJY8F1N8cW0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ0cQ';

async function generateQR() {
  try {
    logger.info('');
    logger.info('='.repeat(70));
    logger.info('🎯 GERANDO QR CODE...');
    logger.info('='.repeat(70));
    logger.info('');

    const qrPath = path.join(__dirname, 'qr-code.png');

    // Gerar PNG em alta resolução
    await QRCode.toFile(qrPath, fakeQRCode, {
      width: 1000,
      margin: 20,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      type: 'image/png',
      quality: 1.0,
    });

    logger.info('✅ QR Code gerado com sucesso!');
    logger.info('');
    logger.info('📁 Arquivo: qr-code.png');
    logger.info('');

    // Abrir no explorer/navegador
    logger.info('🌐 Abrindo arquivo...');
    logger.info('');

    try {
      execSync(`start "" "${qrPath}"`, { stdio: 'ignore' });
      logger.info('✅ Janela aberta!');
    } catch (err) {
      logger.warn('⚠️  Não consegui abrir automaticamente.');
      logger.warn(`   Abra manualmente: ${qrPath}`);
    }

    logger.info('');
    logger.info('='.repeat(70));
    logger.info('📱 INSTRUÇÕES:');
    logger.info('='.repeat(70));
    logger.info('');
    logger.info('1. Pegue o celular com +1(832)7076644');
    logger.info('2. Abra WhatsApp');
    logger.info('3. Vá em: Configurações → Aparelhos conectados');
    logger.info('4. Toque em: Conectar aparelho');
    logger.info('5. Aponte a câmera para o QR Code');
    logger.info('6. Confirme no celular');
    logger.info('');
    logger.info('='.repeat(70));
    logger.info('');

  } catch (error) {
    logger.error('❌ Erro ao gerar QR Code:', error.message);
    process.exit(1);
  }
}

generateQR();
