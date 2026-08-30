// ============================================
// Histórico curto de preço por produto.
//
// As plataformas anunciam o desconto contra um "preço de" que elas mesmas
// escolhem, e ele nem sempre corresponde ao que o produto de fato custava.
// Aqui guardamos o menor preço que o bot já viu com os próprios olhos e só
// deixamos passar a oferta que chegue perto dele.
//
// Na primeira vez que um produto aparece não há com o que comparar, e ele
// passa: aquele preço vira a primeira referência.
// ============================================

const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

const HISTORY_FILE = path.resolve(__dirname, '../../.price_history.json');
const MAX_ENTRIES = 20000;

let history = new Map();
let loaded = false;

function keyFor(source, id) {
  return `${String(source || 'desconhecido')}:${String(id)}`;
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    if (!fs.existsSync(HISTORY_FILE)) return;
    const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    if (!Array.isArray(data)) return;
    history = new Map(data.filter((entry) => Array.isArray(entry) && entry.length === 2));
  } catch (error) {
    logger.warn('[Preço] Não foi possível carregar o histórico:', error.message);
  }
}

function save() {
  try {
    const entries = [...history.entries()].slice(-MAX_ENTRIES);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(entries), 'utf8');
  } catch (error) {
    logger.warn('[Preço] Não foi possível salvar o histórico:', error.message);
  }
}

/**
 * Registra o preço visto e diz se a oferta merece ser publicada.
 *
 * @returns {{ publicar: boolean, menorPreco: number, observacoes: number, motivo: string|null }}
 */
function evaluate(source, id, price) {
  load();

  const value = Number(price);
  if (!Number.isFinite(value) || value <= 0) {
    return { publicar: true, menorPreco: value, observacoes: 0, motivo: null };
  }

  const key = keyFor(source, id);
  const previous = history.get(key);
  const observacoes = previous ? Number(previous.n) || 0 : 0;
  const menorAnterior = previous && Number.isFinite(Number(previous.min)) ? Number(previous.min) : null;

  const registro = {
    min: menorAnterior === null ? value : Math.min(menorAnterior, value),
    last: value,
    n: observacoes + 1,
    t: Date.now(),
  };
  // Não grava aqui: quem chama em lote salva uma vez no fim. Salvar por
  // item reescreveria o arquivo inteiro a cada produto avaliado.
  history.set(key, registro);

  if (!config.priceHistoryEnabled) {
    return { publicar: true, menorPreco: registro.min, observacoes, motivo: null };
  }

  // Sem histórico anterior não há o que contestar: esta é a referência.
  if (menorAnterior === null) {
    return { publicar: true, menorPreco: value, observacoes, motivo: null };
  }

  const teto = menorAnterior * (1 + config.priceHistoryTolerance / 100);
  if (value <= teto) {
    return { publicar: true, menorPreco: registro.min, observacoes, motivo: null };
  }

  return {
    publicar: false,
    menorPreco: menorAnterior,
    observacoes,
    motivo: `já vi por ${menorAnterior.toFixed(2)} e agora está ${value.toFixed(2)}`,
  };
}

/**
 * Filtra promoções que não superam o próprio histórico.
 * Cada promoção precisa trazer `priceValue` com o preço atual em número.
 */
function keepOnlyRealDeals(promos, source) {
  const aprovadas = [];
  for (const promo of promos) {
    const veredito = evaluate(source, promo.id, promo.priceValue);
    if (veredito.publicar) {
      aprovadas.push(promo);
    } else {
      logger.info(`[Preço] Descartada por desconto duvidoso (${veredito.motivo}): ${promo.title}`);
    }
  }
  if (promos.length > 0) save();
  return aprovadas;
}

function resetForTests() {
  history = new Map();
  loaded = true;
}

module.exports = { evaluate, keepOnlyRealDeals, keyFor, resetForTests };
