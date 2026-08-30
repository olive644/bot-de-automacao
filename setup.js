#!/usr/bin/env node

/**
 * Script de verificação pré-inicialização
 * Valida dependências e configurações antes de rodar o bot
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const logger = require('./src/utils/logger');

console.log('\n' + '='.repeat(60));
console.log('🔍 VERIFICANDO CONFIGURAÇÕES DO BOT');
console.log('='.repeat(60) + '\n');

let hasErrors = false;

// --- Verificar dependências ---
console.log('📦 Verificando dependências npm...');
const packages = ['whatsapp-web.js', 'qrcode-terminal', 'dotenv'];
for (const pkg of packages) {
  try {
    require(pkg);
    console.log(`  ✅ ${pkg}`);
  } catch {
    console.log(`  ❌ ${pkg} NÃO INSTALADO`);
    hasErrors = true;
  }
}

// --- Verificar arquivo .env ---
console.log('\n🔐 Verificando arquivo .env...');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('  ✅ Arquivo .env encontrado');
} else {
  console.log('  ⚠️  Arquivo .env NÃO ENCONTRADO');
  console.log('     Copie .env.example para .env e preencha os valores');
  hasErrors = true;
}

// --- Verificar configuração ---
console.log('\n⚙️  Verificando configuração...');
const sourceGroups = process.env.SOURCE_GROUPS;
const destGroup = process.env.DEST_GROUP;

if (sourceGroups && sourceGroups.trim()) {
  const groups = sourceGroups.split(',').map(g => g.trim());
  console.log(`  ✅ SOURCE_GROUPS: ${groups.length} grupo(s) configurado(s)`);
} else {
  console.log('  ⚠️  SOURCE_GROUPS não configurado');
  console.log('     Execute: npm run list-groups');
  hasErrors = true;
}

if (destGroup && destGroup.trim()) {
  console.log(`  ✅ DEST_GROUP: ${destGroup}`);
} else {
  console.log('  ⚠️  DEST_GROUP não configurado');
  hasErrors = true;
}

// --- Verificar diretórios ---
console.log('\n📁 Verificando estrutura de diretórios...');
const dirs = [
  './src/config',
  './src/services',
  './src/utils',
  './src/scripts',
];
for (const dir of dirs) {
  if (fs.existsSync(dir)) {
    console.log(`  ✅ ${dir}`);
  } else {
    console.log(`  ❌ ${dir} NÃO ENCONTRADO`);
    hasErrors = true;
  }
}

// --- Resultado ---
console.log('\n' + '='.repeat(60));
if (hasErrors) {
  console.log('⚠️  CORREÇÕES NECESSÁRIAS:');
  console.log('  1. npm install');
  console.log('  2. cp .env.example .env');
  console.log('  3. npm run list-groups (obter IDs dos grupos)');
  console.log('  4. Preencher SOURCE_GROUPS e DEST_GROUP no .env');
  console.log('='.repeat(60) + '\n');
  process.exit(1);
} else {
  console.log('✅ TODAS AS VERIFICAÇÕES PASSARAM!');
  console.log('Você pode rodar: npm start');
  console.log('='.repeat(60) + '\n');
  process.exit(0);
}
