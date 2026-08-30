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
    // "Use o cupom: JOGA20" só repete o código, que já sai em destaque.
    unexpectedInMessage: 'Use o cupom',
  },
  {
    name: 'Linha complexa de cupom preservada',
    text: 'Monitor gamer em oferta\nPor: R$ 899,90\n🏷️ Cupom de R$ 100 acima de R$ 1.000: MONITOR100\nhttps://www.exemplo.com.br/monitor',
    expectedOriginal: null,
    expectedCurrent: 'R$ 899,90',
    // O código sai em destaque e a condição de uso fica logo abaixo.
    expectedCoupons: ['MONITOR100'],
    // A decoração da origem sai: a fila já prefixa 🎟️ e aplica negrito.
    expectedCouponLine: 'Cupom de R$ 100 acima de R$ 1.000: MONITOR100',
  },
  {
    name: 'Cupom sem código legível não inventa código',
    text: 'Placa de vídeo\nPor: R$ 1.499,00\n🎟️ Cupom de R$ 50 na primeira compra\nhttps://www.exemplo.com.br/placa',
    expectedOriginal: null,
    expectedCurrent: 'R$ 1.499,00',
    expectedCoupons: [],
    expectedCouponLine: 'Cupom de R$ 50 na primeira compra',
  },
  {
    // Formato real do grupo TECNOART: preço anterior riscado e preço atual na
    // mesma linha que cita cupom. Antes, essa linha era descartada inteira e
    // o preço riscado acabava anunciado como preço atual no grupo destino.
    name: 'Preço riscado com cupom citado na linha do preço atual',
    text: '*Processador AMD Ryzen 5 5500 AM4*\n\nDe: ~R$799,00~\n🔥Por: R$499,56 (COM CUPOM, NO PIX)\n\n🎟️ *RESGATE o Cupom*\nhttps://s.shopee.com.br/112WynCE2U',
    expectedOriginal: 'R$799,00',
    expectedCurrent: 'R$499,56',
    expectedTitle: 'Processador AMD Ryzen 5 5500 AM4',
    // "RESGATE" é chamada, não código: não pode virar cupom.
    expectedCoupons: [],
    expectedCouponLine: 'RESGATE o Cupom',
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
  if (test.expectedTitle) {
    assert.equal(info.title, test.expectedTitle);
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
    if (test.expectedCoupons) {
      // O código sai sozinho, em monoespaçado, para a pessoa copiar.
      test.expectedCoupons.forEach((coupon) => {
        assert.ok(formatted.includes(`*CUPOM:* \`${coupon}\``), `Cupom ausente da mensagem: ${coupon}`);
      });
    }
    if (test.expectedCouponLine) {
      assert.ok(formatted.includes(test.expectedCouponLine), `Linha de cupom ausente: ${test.expectedCouponLine}`);
    }
    if (test.unexpectedInMessage) {
      assert.ok(!formatted.includes(test.unexpectedInMessage), `Texto redundante na mensagem: ${test.unexpectedInMessage}`);
    }
  } else {
    console.log('   ⚠️  Nenhuma URL encontrada');
  }
});

console.log('\n' + '='.repeat(60));
console.log('✅ Teste concluído!');
console.log('='.repeat(60) + '\n');
