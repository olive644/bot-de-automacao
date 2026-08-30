#!/usr/bin/env node

/**
 * Script para verificar status da fila
 * Útil para monitorar o bot enquanto está rodando (em outra aba)
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(60));
console.log('📊 STATUS DO BOT DE PROMOÇÕES');
console.log('='.repeat(60));
console.log(`\nData: ${new Date().toLocaleString('pt-BR')}\n`);

// Verificar arquivo de backup da fila
const queueFile = path.join(__dirname, '.queue_backup.json');
if (fs.existsSync(queueFile)) {
  try {
    const queue = JSON.parse(fs.readFileSync(queueFile, 'utf-8'));
    console.log(`⏳ Fila com backup pendente: ${queue.length} promoção(ões)`);
    queue.forEach((promo, i) => {
      console.log(`   ${i + 1}. [${promo.platform}] ${promo.title}`);
    });
  } catch (e) {
    console.log('⚠️  Erro ao ler backup da fila');
  }
} else {
  console.log('✅ Nenhuma fila pendente');
}

// Verificar autenticação
const authDir = path.join(__dirname, '.wwebjs_auth');
if (fs.existsSync(authDir)) {
  const files = fs.readdirSync(authDir);
  console.log(`\n🔐 Sessão salva (${files.length} arquivo(s))`);
  console.log('   → Não precisa escanear QR Code na próxima inicialização');
} else {
  console.log('\n❌ Sessão não autenticada');
  console.log('   → Execute: npm run list-groups (para autenticar)');
}

// Verificar .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf-8');
  const sourceGroups = env.match(/SOURCE_GROUPS=(.+)/)?.[1];
  const destGroup = env.match(/DEST_GROUP=(.+)/)?.[1];

  console.log('\n⚙️  Configuração (.env):');
  if (sourceGroups) {
    const groups = sourceGroups.split(',').length;
    console.log(`   • SOURCE_GROUPS: ${groups} grupo(s)`);
  } else {
    console.log('   ⚠️  SOURCE_GROUPS não configurado');
  }

  if (destGroup) {
    console.log(`   • DEST_GROUP: configurado`);
  } else {
    console.log('   ⚠️  DEST_GROUP não configurado');
  }
} else {
  console.log('\n❌ Arquivo .env não encontrado');
}

// Node modules
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('\n📦 Dependências: instaladas');
} else {
  console.log('\n❌ Dependências: NÃO instaladas (execute: npm install)');
}

console.log('\n' + '='.repeat(60));
console.log('📌 Próximos passos:');
console.log('   • npm start            (iniciar bot)');
console.log('   • npm run list-groups  (obter IDs dos grupos)');
console.log('   • npm run test:regex   (testar extração de dados)');
console.log('='.repeat(60) + '\n');
