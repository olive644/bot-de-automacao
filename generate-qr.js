#!/usr/bin/env node

/**
 * Gera QR Code em arquivo PNG de alta qualidade
 * Abre automaticamente no navegador
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

let qrGenerated = false;
let qrData = null;

// --- Configurar Client ---
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

// --- Quando QR Code for gerado ---
client.on('qr', async (qr) => {
  if (qrGenerated) return; // Evitar múltiplas gerações
  qrGenerated = true;
  qrData = qr;

  logger.info('');
  logger.info('='.repeat(70));
  logger.info('🎯 GERANDO QR CODE DE ALTA QUALIDADE...');
  logger.info('='.repeat(70));

  try {
    // Gerar PNG em alta resolução (1000x1000px)
    const qrPath = path.join(__dirname, 'qr-code.png');

    await QRCode.toFile(qrPath, qr, {
      width: 1000,           // 1000 pixels de largura
      margin: 20,            // Margem
      color: {
        dark: '#000000',     // Preto
        light: '#FFFFFF',    // Branco
      },
      type: 'image/png',
      quality: 1.0,          // Máxima qualidade
    });

    logger.info('✅ QR Code gerado com sucesso!');
    logger.info('');
    logger.info('📁 Arquivo: qr-code.png');
    logger.info('');
    logger.info('🌐 Abrindo no navegador...');
    logger.info('');

    // Criar arquivo HTML para visualizar
    const htmlPath = path.join(__dirname, 'qr-viewer.html');
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QR Code - Conectar WhatsApp</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
      max-width: 800px;
      text-align: center;
    }

    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 32px;
    }

    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 16px;
    }

    .qr-box {
      background: #f8f9fa;
      border-radius: 15px;
      padding: 30px;
      margin: 30px 0;
      display: flex;
      justify-content: center;
    }

    #qrImage {
      max-width: 500px;
      width: 100%;
      height: auto;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    }

    .instructions {
      background: #e3f2fd;
      border-left: 4px solid #2196F3;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: left;
    }

    .instructions h2 {
      color: #2196F3;
      font-size: 18px;
      margin-bottom: 15px;
    }

    .instructions ol {
      margin-left: 20px;
      line-height: 1.8;
      color: #333;
    }

    .instructions li {
      margin-bottom: 10px;
      font-size: 15px;
    }

    .phone-number {
      background: #fff3e0;
      border: 2px solid #ff9800;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      font-weight: bold;
      color: #e65100;
      font-size: 16px;
    }

    .status {
      margin-top: 20px;
      padding: 15px;
      background: #f0f0f0;
      border-radius: 8px;
      color: #666;
      font-size: 14px;
    }

    .tip {
      background: #f1f8e9;
      border-left: 4px solid #4caf50;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: left;
      color: #2e7d32;
    }

    footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #999;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🌐 Conectar WhatsApp ao Bot</h1>
    <p class="subtitle">Escaneie o QR Code abaixo com o seu celular</p>

    <div class="phone-number">
      📱 Número: +1(832)7076644
    </div>

    <div class="qr-box">
      <img id="qrImage" src="qr-code.png?t=${Date.now()}" alt="QR Code para conectar WhatsApp">
    </div>

    <div class="instructions">
      <h2>📋 Instruções:</h2>
      <ol>
        <li><strong>Pegue o celular</strong> com o número +1(832)7076644</li>
        <li><strong>Abra o WhatsApp</strong></li>
        <li>Vá em <strong>Configurações</strong></li>
        <li>Toque em <strong>Aparelhos conectados</strong></li>
        <li>Toque em <strong>Conectar aparelho</strong></li>
        <li><strong>Aponte a câmera para o QR Code</strong> acima</li>
        <li><strong>Confirme no celular</strong></li>
      </ol>
    </div>

    <div class="tip">
      💡 <strong>Dica:</strong> Se o QR Code expirar (após ~30 segundos), feche esta página
      e execute novamente: <code>npm run qr</code>
    </div>

    <div class="status">
      ⏳ Aguardando autenticação... O bot iniciará automaticamente quando você escanear o QR Code.
    </div>

    <footer>
      Bot de Promoções WhatsApp • Fase 1
    </footer>
  </div>

  <script>
    // Recarregar imagem a cada 5 segundos
    setInterval(() => {
      document.getElementById('qrImage').src = 'qr-code.png?t=' + Date.now();
    }, 5000);

    // Fechar após 2 minutos (QR expira)
    setTimeout(() => {
      document.body.innerHTML = \`
        <div class="container" style="text-align: center; padding: 60px 40px;">
          <h1>⏰ QR Code Expirou</h1>
          <p style="color: #666; margin: 20px 0;">O QR Code é válido por apenas 1 minuto.</p>
          <p style="color: #666; margin: 20px 0;">Execute novamente no terminal:</p>
          <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0; font-family: monospace;">
            npm run qr
          </div>
          <button onclick="location.reload()" style="
            padding: 12px 24px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
          ">🔄 Recarregar</button>
        </div>
      \`;
    }, 120000); // 2 minutos
  </script>
</body>
</html>
    `;

    fs.writeFileSync(htmlPath, htmlContent);

    logger.info('✅ Página HTML criada: qr-viewer.html');
    logger.info('');
    logger.info('='.repeat(70));
    logger.info('🎯 QR CODE PRONTO PARA ESCANEAR!');
    logger.info('='.repeat(70));
    logger.info('');
    logger.info('📱 SMARTPHONE (celular):');
    logger.info('  1. Pegue o celular com +1(832)7076644');
    logger.info('  2. Abra WhatsApp');
    logger.info('  3. Configurações → Aparelhos conectados → Conectar aparelho');
    logger.info('  4. Aponte para o QR Code na sua tela');
    logger.info('');
    logger.info('💻 PC (seu computador):');
    logger.info('  • Arquivo: qr-code.png (na pasta automação)');
    logger.info('  • Página: qr-viewer.html (abra no navegador)');
    logger.info('');
    logger.info('⏱️  O QR Code expira em 1 minuto. Escaneie rápido!');
    logger.info('');
    logger.info('='.repeat(70));

    // Abrir no navegador (Windows)
    const { exec } = require('child_process');
    exec(`start ${htmlPath}`, (err) => {
      if (err) {
        logger.warn('⚠️  Não consegui abrir no navegador automaticamente.');
        logger.warn(`   Abra manualmente: ${htmlPath}`);
      }
    });

  } catch (error) {
    logger.error('❌ Erro ao gerar QR Code:', error.message);
    process.exit(1);
  }
});

// --- Quando autenticar ---
client.on('authenticated', () => {
  logger.info('');
  logger.info('='.repeat(70));
  logger.info('✅ AUTENTICAÇÃO BEM-SUCEDIDA!');
  logger.info('='.repeat(70));
  logger.info('');
  logger.info('🎉 Número +1(832)7076644 conectado ao bot!');
  logger.info('');
  logger.info('⏳ Iniciando bot em 3 segundos...');
  logger.info('');

  // Aguardar 3 segundos e iniciar bot principal
  setTimeout(() => {
    startMainBot();
  }, 3000);
});

client.on('ready', () => {
  logger.info('✅ Bot conectado e pronto para operar!');
  logger.info('');
});

client.on('auth_failure', (msg) => {
  logger.error('❌ Falha na autenticação:', msg);
  logger.error('   Tente novamente: npm run qr');
  process.exit(1);
});

// --- Iniciar ---
logger.info('Conectando ao WhatsApp...');
logger.info('Aguarde o QR Code ser gerado...');
client.initialize();

// --- Bot Principal ---
function startMainBot() {
  logger.info('Iniciando bot principal...');

  const config = require('./src/config');
  const { registerListener } = require('./src/services/listener');
  const { startProcessing, stopProcessing, saveBeforeExit } = require('./src/services/queue');

  if (config.sourceGroups.length === 0 || !config.destGroup) {
    logger.warn('');
    logger.warn('⚠️  CONFIGURAÇÃO INCOMPLETA!');
    logger.warn('');
    logger.warn('Para usar o bot, você precisa:');
    logger.warn('  1. npm run list-groups');
    logger.warn('  2. Editar o arquivo .env');
    logger.warn('  3. Definir SOURCE_GROUPS e DEST_GROUP');
    logger.warn('');
    logger.warn('Exemplo:');
    logger.warn('  SOURCE_GROUPS=120363111111111@g.us,120363222222222@g.us');
    logger.warn('  DEST_GROUP=120363333333333@g.us');
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
  logger.info(`📋 Grupos fonte configurados: ${config.sourceGroups.length}`);
  logger.info(`🎯 Grupo destino: ${config.destGroup}`);
  logger.info('');
  logger.info('Bot está escutando e pronto para processar promoções!');
  logger.info('');

  process.on('SIGINT', async () => {
    logger.info('Encerrando bot...');
    stopProcessing();
    saveBeforeExit();

    try {
      await client.destroy();
      logger.info('Sessão encerrada.');
    } catch (err) {
      logger.error('Erro:', err.message);
    }

    process.exit(0);
  });
}
