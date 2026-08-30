#!/usr/bin/env node

/**
 * Script de teste para verificar se os regex capturam corretamente
 * Não requer conexão com WhatsApp
 */

const { extractPromoInfo } = require('./src/utils/regex');
const { formatMessage } = require('./src/services/queue');
const assert = require('node:assert/strict');

console.log('\n' + '='.repeat(60));
console.log('🧪 TESTE DE REGEX E PRESERVAÇÃO DE LINKS');
console.log('='.repeat(60) + '\n');

// Exemplos de mensagens de promoção
const testMessages = [
  {
    name: 'Mercado Livre - Link simples',
    text: 'Fone Bluetooth Sony 🎧\nhttps://www.mercadolivre.com.br/p/produto123?aff=test\nR$ 149,90',
  },
  {
    name: 'Amazon - Com preço formatado',
    text: 'iPhone 14 Pro 📱\nhttps://amzn.to/XYZABC\nR$ 5.299,00',
  },
  {
    name: 'Shopee - Múltiplos preços',
    text: 'Múltiplas ofertas hoje!\nShirt: R$ 29,90\nhttps://shope.ee/ABCDEF123\nCalça: R$ 79,90',
  },
  {
    name: 'Magalu - Sem preço',
    text: 'Produto em promoção!\nhttps://www.magazineluiza.com.br/produto/123',
  },
  {
    name: 'Múltiplos links preservados',
    text: 'Confira estas opções\nhttps://www.exemplo.com.br/item\nhttps://loja.exemplo.com.br/oferta?cupom=OLI10',
  },
];

testMessages.forEach((test, idx) => {
  console.log(`\n${idx + 1}. ${test.name}`);
  console.log('-'.repeat(60));

  // Extrai informações
  const info = extractPromoInfo(test.text);
  console.log('📝 Mensagem:');
  console.log('   ' + test.text.replace(/\n/g, '\n   '));

  console.log('\n✅ Extraído:');
  if (info.title) {
    console.log(`   • Título: "${info.title}"`);
  }
  if (info.prices.length > 0) {
    console.log(`   • Preços: ${info.prices.join(', ')}`);
  }
  if (info.urls.length > 0) {
    console.log(`   • URLs: ${info.urls.length} encontrada(s)`);
    info.urls.forEach((url, i) => {
      console.log(`     ${i + 1}. Original: ${url}`);
    });

    const formatted = formatMessage(info);
    info.urls.forEach((url) => {
      assert.ok(formatted.includes(url), `Link original ausente da mensagem: ${url}`);
    });
    assert.ok(formatted.includes('Oli - Bot'), 'Assinatura do Oli - Bot ausente');
  } else {
    console.log('   ⚠️  Nenhuma URL encontrada');
  }
});

console.log('\n' + '='.repeat(60));
console.log('✅ Teste concluído!');
console.log('='.repeat(60) + '\n');
