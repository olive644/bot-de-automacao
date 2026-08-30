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

const observedChats = new Set();

function printObservedChat(message) {
  const chatId = message.from || '';
  const isGroup = chatId.endsWith('@g.us');
  const isChannel = chatId.endsWith('@newsletter');

  if ((!isGroup && !isChannel) || observedChats.has(chatId)) return;

  observedChats.add(chatId);
  console.log('\nChat detectado por mensagem:');
  console.log(`  ID: ${chatId}`);
  console.log(`  Tipo: ${isChannel ? 'canal' : 'grupo'}`);
  console.log('  Copie esse ID para o arquivo .env.\n');
}

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

// Alternativa ao getChats(): detecta inclusive mensagens enviadas pelo
// próprio número conectado, sem depender da listagem interna do WhatsApp Web.
client.on('message', printObservedChat);
client.on('message_create', printObservedChat);

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
    let channels = chats.filter(
      (chat) => chat.id && chat.id._serialized && chat.id._serialized.endsWith('@newsletter')
    );

    // Nas versões atuais, canais podem ser retornados separadamente.
    if (typeof client.getChannels === 'function') {
      try {
        channels = await client.getChannels();
      } catch (channelError) {
        console.warn('Não foi possível listar canais:', channelError.message || channelError);
      }
    }

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
    console.error('Erro ao buscar chats:', error.stack || error);
    console.log('\nMODO ALTERNATIVO ATIVADO');
    console.log('Envie uma mensagem no grupo desejado usando qualquer participante.');
    console.log('O ID aparecerá aqui automaticamente.');
    console.log('Pressione Ctrl+C quando terminar.\n');
    return;
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
