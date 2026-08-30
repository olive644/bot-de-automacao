// ============================================
// Fila de processamento de promoções
// Garante envio sequencial com delays humanizados
// ============================================

const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const config = require('../config');
const logger = require('../utils/logger');
const { randomDelay, formatMs } = require('../utils/delay');
const { downloadImage } = require('../utils/media');

// Fila FIFO interna — armazena as promoções pendentes
const queue = [];

// Flag para controle do loop de processamento
let isProcessing = false;

// Arquivo de persistência da fila
const QUEUE_FILE = path.join(__dirname, '../../.queue_backup.json');

function isBlockedPromotion(promo) {
  const text = [
    promo?.title,
    promo?.sourceGroup,
    promo?.rawText,
    ...(Array.isArray(promo?.urls) ? promo.urls : []),
  ].filter(Boolean).join(' ');

  if (/\bfanatical\b/i.test(text)) return true;

  const isItad = promo?.sourceGroup === 'IsThereAnyDeal';
  const hasArabicTitle = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u.test(promo?.title || '');
  return isItad && config.itadExcludeArabicTitles && hasArabicTitle;
}

/**
 * Carrega fila do arquivo de backup (se existir).
 * Útil para recuperar promoções após um restart.
 */
function loadQueueFromDisk() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const data = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
      const allowed = data.filter((promo) => !isBlockedPromotion(promo));
      queue.push(...allowed);
      const discarded = data.length - allowed.length;
      logger.info(`[Fila] ${allowed.length} promoção(ões) restaurada(s) do backup.`);
      if (discarded > 0) logger.info(`[Fila] ${discarded} oferta(s) de jogos bloqueada(s) removida(s) do backup.`);
      // O arquivo não é apagado aqui: quem o mantém em dia agora é o
      // saveQueueToDisk a cada mudança, e ele some sozinho quando a fila
      // esvazia. Apagar aqui abriria uma janela de perda até o primeiro save.
    }
  } catch (error) {
    logger.warn(`[Fila] Erro ao carregar backup da fila:`, error.message);
  }
}

/**
 * Salva a fila no disco. Chamado a cada mudança, não só no encerramento:
 * com auto-restart, queda virou rotina, e antes disso toda queda dura
 * levava embora as promoções pendentes sem deixar rastro.
 *
 * Fila vazia apaga o arquivo. Se ele ficasse para trás com conteúdo
 * antigo, o próximo restart reenviaria promoções já entregues.
 */
function saveQueueToDisk() {
  try {
    if (queue.length === 0) {
      if (fs.existsSync(QUEUE_FILE)) fs.unlinkSync(QUEUE_FILE);
      return;
    }
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');
    logger.debug(`[Fila] ${queue.length} promoção(ões) salva(s) em backup.`);
  } catch (error) {
    logger.warn(`[Fila] Erro ao salvar backup da fila:`, error.message);
  }
}

// Carrega fila ao inicializar o módulo
loadQueueFromDisk();

/**
 * Adiciona uma promoção na fila de envio.
 *
 * @param {object} promo - Objeto da promoção
 * @param {string} promo.title - Título da promoção
 * @param {string[]} promo.urls - Links originais da mensagem
 * @param {string[]} promo.prices - Preços encontrados
 * @param {string[]} promo.coupons - Cupons encontrados na mensagem de origem
 * @param {string[]} promo.couponLines - Linhas de cupom preservadas da origem
 * @param {string|null} promo.originalPrice - Preço anterior
 * @param {string|null} promo.currentPrice - Preço atual
 * @param {object|null} promo.media - Imagem em base64
 * @param {string} promo.rawText - Texto original da mensagem
 */
function enqueue(promo) {
  if (isBlockedPromotion(promo)) {
    logger.info(`[Fila] Oferta bloqueada ignorada: ${promo?.title || 'sem título'}`);
    return false;
  }
  queue.push(promo);
  saveQueueToDisk();
  logger.info(`[Fila] Promoção adicionada. Tamanho da fila: ${queue.length}`);
  logger.debug(`[Fila] Detalhes:`, {
    title: promo.title,
    urls: promo.urls,
  });
  return true;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}

/**
 * Diz se a linha de cupom não acrescenta nada além do próprio código.
 * "Use o cupom: JOGA20" só repete o código; já "Cupom de R$ 100 acima de
 * R$ 1.000: MONITOR100" carrega a condição de uso e precisa ser mantida.
 */
function onlyRepeatsCoupon(line, coupon) {
  const remaining = String(line || '')
    .replace(new RegExp(escapeRegExp(coupon), 'gi'), ' ')
    .replace(/\b(?:use|usar|aplique|o|a|os|as|do|da|de|no|na|com|cupom|cupons|c[oó]digo|promocional|desconto)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '');
  return remaining.length < 4;
}

/**
 * Monta o bloco do cupom. O código vem sozinho, em monoespaçado, porque é o
 * que a pessoa precisa copiar; a condição de uso vem logo abaixo, e só
 * quando diz algo além do código.
 */
function buildCouponBlock(promo) {
  const coupons = Array.isArray(promo.coupons) ? promo.coupons : [];
  const couponLines = Array.isArray(promo.couponLines) ? promo.couponLines : [];

  const block = coupons.map((coupon) => `🎟️ *CUPOM:* \`${coupon}\``);
  const extras = couponLines.filter((line) => !coupons.some((coupon) => onlyRepeatsCoupon(line, coupon)));

  if (coupons.length === 0) return extras.map((line) => `🎟️ *${line}*`);
  return [...block, ...extras.map((line) => `↳ ${line}`)];
}

/**
 * Formata a mensagem de promoção para envio no grupo destino.
 * Personaliza o formato conforme desejar.
 *
 * @param {object} promo - Objeto da promoção
 * @returns {string} - Mensagem formatada
 */
function formatMessage(promo) {
  const parts = ['✨ *OFERTA ENCONTRADA*'];

  if (promo.title) {
    parts.push(`\n*${promo.title}*`);
  }

  if (promo.originalPrice && promo.currentPrice && promo.originalPrice !== promo.currentPrice) {
    parts.push(`~De: ${promo.originalPrice}~`);
    parts.push(`🔥 *Por: ${promo.currentPrice}*`);
  } else if (promo.currentPrice) {
    parts.push(`💰 *Preço: ${promo.currentPrice}*`);
  }

  const couponBlock = buildCouponBlock(promo);
  if (couponBlock.length > 0) {
    parts.push('');
    parts.push(...couponBlock);
  }

  if (promo.urls && promo.urls.length > 0) {
    parts.push(`\n${promo.urls.map((url) => `🔗 ${url}`).join('\n')}`);
  }

  return parts.join('\n');
}

/**
 * Envia uma mensagem para o grupo destino com simulação de typing.
 * Com retry automático em caso de falha.
 *
 * Fluxo:
 *   1. Aguarda um tempo de digitação humanizado
 *   2. Envia diretamente para o ID do grupo destino
 *   3. Em caso de erro, retenta com backoff exponencial
 *
 * @param {import('whatsapp-web.js').Client} client - Client do WhatsApp
 * @param {object} promo - Promoção a ser enviada
 * @param {number} [attempt=1] - Número da tentativa
 */
async function sendPromo(client, promo, attempt = 1) {
  const MAX_RETRIES = 3;
  const message = formatMessage(promo);

  try {
    // Evita getChatById/sendStateTyping, afetados por mudanças internas
    // recentes do WhatsApp Web. O atraso continua espaçando os envios.
    const typingTime = await randomDelay(config.typingDelayMin, config.typingDelayMax);
    logger.info(`[Fila] Aguardando ${formatMs(typingTime)} antes do envio...`);

    // O listener já traz a imagem pronta em `media`. Os coletores guardam só
    // a URL, e ela vira imagem agora, na hora do envio.
    if (!promo.media && promo.imageUrl && config.sendProductImages) {
      promo.media = await downloadImage(promo.imageUrl);
    }

    if (promo.media?.data && promo.media?.mimetype) {
      try {
        const media = new MessageMedia(
          promo.media.mimetype,
          promo.media.data,
          promo.media.filename || 'oferta.jpg'
        );
        await client.sendMessage(config.destGroup, media, { caption: message });
      } catch (mediaError) {
        logger.warn('[Fila] Falha ao enviar imagem; tentando somente o texto:', mediaError.message);
        await client.sendMessage(config.destGroup, message);
      }
    } else {
      await client.sendMessage(config.destGroup, message);
    }

    logger.info(`[Fila] ✅ Promoção enviada: "${promo.title || 'Sem título'}"`);
  } catch (error) {
    logger.error(`[Fila] ❌ Erro ao enviar (tentativa ${attempt}/${MAX_RETRIES}):`, error.message);

    if (attempt < MAX_RETRIES) {
      // Backoff exponencial: 5s, 15s, 30s
      const backoffMs = Math.pow(attempt, 2) * 5000;
      logger.info(`[Fila] Aguardando ${formatMs(backoffMs)} antes de retry...`);
      await randomDelay(backoffMs, backoffMs + 5000);
      return sendPromo(client, promo, attempt + 1);
    } else {
      logger.error(`[Fila] Falhou após ${MAX_RETRIES} tentativas. Descartando promoção.`);
      throw error;
    }
  }
}

/**
 * Loop principal de processamento da fila.
 * Roda indefinidamente enquanto o bot estiver ativo.
 *
 * Comportamento:
 *   - Se há itens na fila: processa o próximo com delay entre envios
 *   - Se fila vazia: aguarda o intervalo de verificação e checa novamente
 *
 * @param {import('whatsapp-web.js').Client} client - Client do WhatsApp
 */
async function startProcessing(client) {
  if (isProcessing) {
    logger.warn('[Fila] Processamento já está ativo. Ignorando chamada duplicada.');
    return;
  }

  isProcessing = true;
  logger.info('[Fila] Processador de fila iniciado.');

  while (isProcessing) {
    if (queue.length > 0) {
      // Remove o primeiro item (FIFO)
      const promo = queue.shift();
      logger.info(`[Fila] Processando promoção. Restam ${queue.length} na fila.`);

      if (isBlockedPromotion(promo)) {
        logger.info(`[Fila] Oferta antiga bloqueada descartada: ${promo?.title || 'sem título'}`);
        continue;
      }

      try {
        await sendPromo(client, promo);
      } catch (error) {
        logger.error(`[Fila] Erro ao enviar promoção:`, error.message);
        // Não re-adiciona na fila para evitar loop infinito de erros
      } finally {
        // Só grava depois de tentar o envio. Se o processo morrer no meio,
        // a promoção continua no backup e é reenviada no restart. Preferimos
        // arriscar uma repetição a perder a oferta em silêncio.
        saveQueueToDisk();
      }

      // Delay aleatório entre mensagens (anti-banimento)
      if (queue.length > 0) {
        const waitTime = await randomDelay(config.queueDelayMin, config.queueDelayMax);
        logger.info(`[Fila] Aguardando ${formatMs(waitTime)} antes do próximo envio...`);
      }
    } else {
      // Fila vazia — aguarda antes de verificar novamente
      await randomDelay(config.queueCheckInterval, config.queueCheckInterval + 5000);
    }
  }
}

/**
 * Para o processamento da fila (graceful shutdown).
 */
function stopProcessing() {
  isProcessing = false;
  logger.info('[Fila] Processamento parado.');
}

/**
 * Retorna o tamanho atual da fila (útil para debug/monitoramento).
 */
function getQueueSize() {
  return queue.length;
}

/**
 * Obter estatísticas da fila (para dashboard/monitoramento futuro).
 */
function getQueueStats() {
  return {
    size: queue.length,
    processing: isProcessing,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Força salvamento da fila (para shutdown graceful).
 */
function saveBeforeExit() {
  saveQueueToDisk();
}

module.exports = {
  enqueue,
  startProcessing,
  stopProcessing,
  getQueueSize,
  getQueueStats,
  saveBeforeExit,
  formatMessage,
  buildCouponBlock,
  isBlockedPromotion,
};
