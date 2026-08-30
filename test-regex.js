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
    text: 'Fone Bluetooth Sony 🎧\nDe: R$ 199,90\nPor: R$ 149,90\nhttps://www.mercadolivre.com.br/p/produto123?aff=test',
    expectedOriginal: 'R$ 199,90',
    expectedCurrent: 'R$ 149,90',
  },
  {
    name: 'Amazon - Com preço formatado',
    text: 'iPhone 14 Pro 📱\nhttps://amzn.to/XYZABC\nR$ 5.299,00',
    expectedOriginal: null,
    expectedCurrent: 'R$ 5.299,00',
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
  {
    name: 'Cupom destacado na mensagem final',
    text: 'Jogo em promoção\nDe: R$ 199,90\nPor: R$ 89,90\nUse o cupom: JOGA20\nhttps://www.exemplo.com.br/jogo',
    expectedOriginal: 'R$ 199,90',
    expectedCurrent: 'R$ 89,90',
    expectedCoupons: ['JOGA20'],
    expectedCouponLine: 'Use o cupom: JOGA20',
  },
  {
    name: 'Linha complexa de cupom preservada',
    text: 'Monitor gamer em oferta\nPor: R$ 899,90\n🏷️ Cupom de R$ 100 acima de R$ 1.000: MONITOR100\nhttps://www.exemplo.com.br/monitor',
    expectedOriginal: null,
    expectedCurrent: 'R$ 899,90',
    expectedCouponLine: '🏷️ Cupom de R$ 100 acima de R$ 1.000: MONITOR100',
  },
];

testMessages.forEach((test, idx) => {
  console.log(`\n${idx + 1}. ${test.name}`);
  console.log('-'.repeat(60));

  // Extrai informações
  const info = extractPromoInfo(test.text);
  if (Object.hasOwn(test, 'expectedCurrent')) {
    assert.equal(info.originalPrice, test.expectedOriginal);
    assert.equal(info.currentPrice, test.expectedCurrent);
  }
  if (Object.hasOwn(test, 'expectedCoupons')) {
    assert.deepEqual(info.coupons, test.expectedCoupons);
  }
  if (test.expectedCouponLine) {
    assert.ok(info.couponLines.includes(test.expectedCouponLine));
  }
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
    assert.doesNotMatch(formatted, /Enviado por|Oli\s*-?\s*Bot/i, 'A mensagem não deve conter assinatura automática');
    if (test.expectedOriginal) {
      assert.ok(formatted.includes(`~De: ${test.expectedOriginal}~`));
      assert.ok(formatted.includes(`*Por: ${test.expectedCurrent}*`));
    } else if (test.expectedCurrent) {
      assert.ok(formatted.includes(`*Preço: ${test.expectedCurrent}*`));
    }
    if (test.expectedCoupons && !test.expectedCouponLine) {
      test.expectedCoupons.forEach((coupon) => {
        assert.ok(formatted.includes(`\`${coupon}\``), `Cupom ausente da mensagem: ${coupon}`);
      });
    }
    if (test.expectedCouponLine) {
      assert.ok(formatted.includes(test.expectedCouponLine), `Linha de cupom ausente: ${test.expectedCouponLine}`);
    }
  } else {
    console.log('   ⚠️  Nenhuma URL encontrada');
  }
});

console.log('\n' + '='.repeat(60));
console.log('✅ Teste concluído!');
console.log('='.repeat(60) + '\n');
