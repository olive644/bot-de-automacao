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
  {
    // Caso real do TECNOART que chegou ao grupo sem nenhum preço: a
    // marcação do WhatsApp ficava colada aos dígitos, não em volta do
    // "R$" inteiro, tipo "R$ ~325,99~" e "R$ *240,58*", e o regex de preço
    // não casava com nenhum dos dois, então prices ficava vazio.
    name: 'Preço com marcação colada aos dígitos (não só em volta do texto)',
    text: 'Processador Intel Xeon E5-2667 V4 3.2GHz Turbo 3.6GHz 8 Núcleos FCLGA2011-3!\r\n\r\nDe: R$ ~325,99~\r\n🔥 Por: R$ *240,58 _(COM CUPOM)_*\r\n\r\n🎟️Use o Cupom: *QUEROPROMO*\r\n\r\n🔗  Link do Produto:\r\nhttps://meli.la/2tCD7ky',
    expectedOriginal: 'R$ 325,99',
    expectedCurrent: 'R$ 240,58',
    expectedCoupons: ['QUEROPROMO'],
  },
  {
    // "Cupom" maiúsculo é o jeito mais comum de escrever no início de
    // linha, e a regra 1 de extractCoupons não tinha a flag "i": só
    // casava "cupom" minúsculo. Passava batido porque a regra 2 (código
    // no fim da linha) cobria por acidente quando não havia nada depois
    // do código, mas "+ Moedas" depois de "BRFS3" já derrubava as duas.
    name: 'Cupom maiúsculo com texto depois do código',
    text: 'Placa-mãe B450m\nValor: R$290\nCupom: BRFS3 + Moedas\nhttps://www.exemplo.com.br/placa-mae',
    expectedOriginal: null,
    expectedCurrent: 'R$290',
    expectedCoupons: ['BRFS3'],
  },
  {
    // Caso real do canal @LopesPromo: o link de "moedas" da AliExpress só
    // funciona no app, e o próprio vendedor avisou isso com um ❗️. Antes,
    // esse aviso não era preço, cupom nem URL, então sumia em silêncio, e
    // quem recebia a oferta não entendia por que o link "abria uma aba
    // aleatória" em vez do produto.
    name: 'Aviso da origem preservado (link que só funciona no app)',
    text: 'Placa-mãe B450m Qiyida, Ryzen de 1ª a 5ª geração\n\nValor: R$290\n\nCupom: BRFS3 + Moedas\n\nLink: https://s.click.aliexpress.com/e/_c34DgdMx\n❗️Apenas APP no CELULAR, vai abrir a pág de moedas e clique no 1° anúncio (se não aparecer, vai na aba BRASIL)',
    expectedOriginal: null,
    expectedCurrent: 'R$290',
    expectedNote: 'Apenas APP no CELULAR, vai abrir a pág de moedas e clique no 1° anúncio (se não aparecer, vai na aba BRASIL)',
  },
  {
    // Caso real do canal GRUPOSTECNOART: preço sem separador de milhar
    // ("R$2298" em vez de "R$2.298" ou "R$ 2298"). O regex antigo só pegava
    // os 3 primeiros dígitos e descartava o resto, então uma placa de R$2.298
    // saía anunciada por R$229, e o preço "com desconto" de R$2098 virava
    // R$209, dez vezes menor que o valor real do produto.
    name: 'Preço sem separador de milhar (quatro dígitos corridos)',
    text: 'Placa De Vídeo Amd Rx6600 8gb Gddr6 + Brinde Kit De Fans C/3\n\nDe: R$2298\n💰🔥 Valor: R$2098\n\n✅ Link do produto\nhttps://meli.la/1vEWc7S',
    expectedOriginal: 'R$2298',
    expectedCurrent: 'R$2098',
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
  if (test.expectedNote) {
    assert.ok(info.notes.includes(test.expectedNote), `Aviso ausente na extração: ${test.expectedNote}`);
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
    // O rótulo é "Valor" nos dois casos; o que muda é a linha riscada com
    // o preço anterior, que só aparece quando ele existe.
    if (test.expectedOriginal) {
      assert.ok(formatted.includes(`~De: ${test.expectedOriginal}~`));
      assert.ok(formatted.includes(`*Valor: ${test.expectedCurrent}*`));
    } else if (test.expectedCurrent) {
      assert.ok(formatted.includes(`*Valor: ${test.expectedCurrent}*`));
      assert.ok(!formatted.includes('~De:'), 'sem preço anterior não pode haver linha riscada');
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
    if (test.expectedNote) {
      assert.ok(formatted.includes(test.expectedNote), `Aviso ausente na mensagem final: ${test.expectedNote}`);
    }
  } else {
    console.log('   ⚠️  Nenhuma URL encontrada');
  }
});

console.log('\n' + '='.repeat(60));
console.log('✅ Teste concluído!');
console.log('='.repeat(60) + '\n');
