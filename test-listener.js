const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeChatId } = require('./src/utils/chat-id');
const { getMessageText, resolveConfiguredSource, processMessage, registerListener } = require('./src/services/listener');
const { formatMessage, getQueueSize } = require('./src/services/queue');

// Este teste enfileira de verdade, e a fila passou a gravar em disco a cada
// enfileiramento. Sem preservar e devolver o backup, rodar a suíte injeta
// promoções falsas na fila de produção — e o bot as envia ao grupo.
const QUEUE_FILE = path.resolve(__dirname, '.queue_backup.json');
const filaAntes = fs.existsSync(QUEUE_FILE) ? fs.readFileSync(QUEUE_FILE, 'utf8') : null;
process.on('exit', () => {
  if (filaAntes === null) { try { fs.unlinkSync(QUEUE_FILE); } catch (_) {} }
  else fs.writeFileSync(QUEUE_FILE, filaAntes, 'utf8');
});

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
