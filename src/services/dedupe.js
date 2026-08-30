// ============================================
// Não repetir a mesma oferta vinda de fontes diferentes.
//
// Cada fonte já evita repetir a si mesma, mas nenhuma sabe da outra.
// Medido nos canais configurados: os códigos NATORCIDA, SUPERACHADO,
// CELULARTECH200 e NVIDIA apareciam em dois canais ao mesmo tempo, e o
// grupo recebia o mesmo cupom duas vezes.
//
// Vale também para o mesmo produto achado pelo Mercado Livre e pelo
// AliExpress, e para o link que um canal republica dias depois.
// ============================================

const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

const STATE_FILE = path.resolve(__dirname, '../../.dedupe.json');
const MAX_ENTRIES = 8000;

let vistos = new Map();
let carregado = false;

function janelaMs() {
  return config.dedupeWindowHours * 60 * 60 * 1000;
}

function load() {
  if (carregado) return;
  carregado = true;
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (Array.isArray(data)) vistos = new Map(data.filter((e) => Array.isArray(e) && e.length === 2));
  } catch (error) {
    logger.warn('[Repetida] Não foi possível carregar o histórico:', error.message);
  }
}

function prune() {
  const limite = Date.now() - janelaMs();
  for (const [chave, quando] of vistos) {
    if (Number(quando) < limite) vistos.delete(chave);
  }
}

function save() {
  try {
    const entradas = [...vistos.entries()].slice(-MAX_ENTRIES);
    fs.writeFileSync(STATE_FILE, JSON.stringify(entradas), 'utf8');
  } catch (error) {
    logger.warn('[Repetida] Não foi possível salvar o histórico:', error.message);
  }
}

/**
 * Reduz o link ao que identifica o produto: fora protocolo, "www.",
 * parâmetros de rastreio e barra final. Sem isso, o mesmo produto com
 * "?utm_source=x" passaria por oferta diferente.
 *
 * Encurtador fica como está: só o destino diria se é o mesmo produto, e
 * resolvê-lo exigiria uma requisição por link.
 */
function canonicalUrl(url) {
  try {
    const alvo = new URL(String(url));
    const host = alvo.hostname.replace(/^www\./i, '').toLowerCase();
    const caminho = alvo.pathname.replace(/\/+$/, '').toLowerCase();
    return `${host}${caminho}`;
  } catch (_) {
    return String(url || '').trim().toLowerCase();
  }
}

/**
 * As chaves pelas quais duas ofertas são consideradas a mesma: cada link
 * e cada código de cupom.
 */
function keysFor(promo) {
  const chaves = [];
  for (const url of Array.isArray(promo?.urls) ? promo.urls : []) {
    const limpa = canonicalUrl(url);
    if (limpa) chaves.push(`url:${limpa}`);
  }
  for (const cupom of Array.isArray(promo?.coupons) ? promo.coupons : []) {
    const codigo = String(cupom || '').trim().toUpperCase();
    if (codigo) chaves.push(`cupom:${codigo}`);
  }
  return chaves;
}

/**
 * Diz se a promoção é repetida e, quando não é, registra as chaves dela.
 */
function isDuplicate(promo) {
  if (!config.dedupeEnabled) return false;
  load();
  prune();

  const chaves = keysFor(promo);
  if (chaves.length === 0) return false;

  const repetida = chaves.find((chave) => vistos.has(chave));
  if (repetida) return true;

  const agora = Date.now();
  for (const chave of chaves) vistos.set(chave, agora);
  save();
  return false;
}

function resetForTests() {
  vistos = new Map();
  carregado = true;
}

module.exports = { isDuplicate, canonicalUrl, keysFor, resetForTests };
