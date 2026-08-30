// ============================================
// Script auxiliar: Lista todos os grupos do WhatsApp
// ============================================
// Uso: npm run list-groups  ou  node src/scripts/list-groups.js
//
// Este script conecta ao WhatsApp, lista todos os grupos
// com seus nomes e IDs, e encerra automaticamente.
//
// Copie os IDs desejados para o seu arquivo .env
// ============================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', (qr) => {
  console.log('\nEscaneie o QR Code abaixo para conectar:\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  console.log('\nConectado! Buscando grupos e canais...\n');

  try {
    const chats = await client.getChats();

    // --- GRUPOS ---
    const groups = chats.filter((chat) => chat.isGroup);
    console.log('='.repeat(70));
    console.log(`GRUPOS (${groups.length} encontrados):`);
    console.log('='.repeat(70));

    if (groups.length === 0) {
      console.log('  Nenhum grupo encontrado.');
    } else {
      groups.forEach((group, index) => {
        const participants = group.participants ? group.participants.length : '?';
        console.log(`  ${index + 1}. ${group.name}`);
        console.log(`     ID: ${group.id._serialized}`);
        console.log(`     Participantes: ${participants}`);
        console.log('');
      });
    }

    // --- CANAIS (aba Atualizações) ---
    // Canais têm o tipo 'newsletter' ou id terminando em @newsletter
    const channels = chats.filter(
      (chat) => chat.id && chat.id._serialized && chat.id._serialized.endsWith('@newsletter')
    );

    console.log('='.repeat(70));
    console.log(`CANAIS / ABA ATUALIZAÇÕES (${channels.length} encontrados):`);
    console.log('='.repeat(70));

    if (channels.length === 0) {
      console.log('  Nenhum canal encontrado.');
      console.log('  Dica: certifique-se de que você segue o canal no WhatsApp.');
    } else {
      channels.forEach((channel, index) => {
        console.log(`  ${index + 1}. ${channel.name}`);
        console.log(`     ID: ${channel.id._serialized}`);
        console.log('');
      });
    }

    console.log('='.repeat(70));
    console.log('\nCOPIE OS IDs ACIMA E COLE NO SEU ARQUIVO .env');
    console.log('Exemplo:');
    console.log('  SOURCE_GROUPS=120363XXXXXXXXXX@newsletter   <- canal fonte');
    console.log('  DEST_GROUP=120363ZZZZZZZZZZ@g.us           <- grupo destino');
  } catch (error) {
    console.error('Erro ao buscar chats:', error.message);
  }

  // Encerra a sessão e o processo
  console.log('\nEncerrando...');
  await client.destroy();
  process.exit(0);
});

client.on('auth_failure', (msg) => {
  console.error('Falha na autenticação:', msg);
  process.exit(1);
});

console.log('Iniciando conexão com WhatsApp...');
console.log('Aguardando QR Code...\n');
client.initialize();
