const assert = require('node:assert/strict');
const { preserveState } = require('./test-helpers');
const { normalizeChatId } = require('./src/utils/chat-id');
const { getMessageText, resolveConfiguredSource, processMessage, registerListener } = require('./src/services/listener');
const { formatMessage, getQueueSize } = require('./src/services/queue');
const dedupe = require('./src/services/dedupe');

// Este teste enfileira de verdade, e vários módulos gravam em disco a cada
// enfileiramento. Sem preservar e devolver o estado, a suíte injeta
// promoções falsas na fila de produção — e o bot as envia ao grupo.
preserveState();
// Sem limpar, o link de teste ficaria marcado como "já visto" de uma
// execução anterior e o enfileiramento seria recusado como repetido.
dedupe.resetForTests();

const source = '120363123456789@g.us';

async function run() {
  assert.equal(normalizeChatId(`\u200B ${source.toUpperCase()} \uFEFF`), source);
  assert.equal(resolveConfiguredSource({ from: source, to: '551199999999@c.us' }, [source]), source);
  assert.equal(resolveConfiguredSource({ from: '551199999999@c.us', to: source, fromMe: true }, [source]), source);
  assert.equal(resolveConfiguredSource({ from: '551188888888@c.us', to: '551199999999@c.us' }, [source]), '');

  assert.equal(getMessageText({ body: '', _data: { caption: 'Oferta com legenda' } }), 'Oferta com legenda');
  assert.equal(
    getMessageText({ body: 'Oferta', links: [{ link: 'https://exemplo.com/produto' }] }),
    'Oferta\nhttps://exemplo.com/produto'
  );

  const formatted = formatMessage({
    title: 'Produto em promoção',
    currentPrice: 'R$ 99,90',
    urls: ['https://exemplo.com/produto'],
  });
  assert.doesNotMatch(formatted, /Enviado por|Oli\s*-?\s*Bot/i);

  const events = [];
  registerListener({ on: (event) => events.push(event) });
  assert.deepEqual(events, ['message', 'message_create']);

  const before = getQueueSize();
  await processMessage(
    { from: source, hasMedia: false },
    'Grupo de promoções',
    source,
    'SSD NVMe\nDe: R$ 299,90\nPor: R$ 199,90\nhttps://exemplo.com/ssd'
  );
  assert.equal(getQueueSize(), before + 1);

  console.log('Listener: IDs, eventos, legendas, fila e mensagem final válidos.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
