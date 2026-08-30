// ============================================
// Autodiagnóstico das fontes.
//
// O motivo de existir: o Mercado Livre ficou quebrado por dias e nada
// avisou — a falha só apareceu quando alguém reparou que o grupo estava
// parado. Um coletor que erra continua logando e seguindo em frente, e um
// aviso por ciclo se perde no meio de tudo.
//
// Aqui as fontes registram cada ciclo, e de tempos em tempos o bot olha a
// janela inteira e diz, em uma linha por fonte, quem está entregando e
// quem parou.
// ============================================

const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

const STATE_FILE = path.resolve(__dirname, '../../.health.json');

let events = [];
let timer = null;
let loaded = false;

function windowMs() {
  return config.healthWindowHours * 60 * 60 * 1000;
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (Array.isArray(data)) events = data;
  } catch (error) {
    logger.warn('[Saúde] Não foi possível carregar o histórico de coletas:', error.message);
  }
}

function prune() {
  const limite = Date.now() - windowMs();
  events = events.filter((event) => Number(event.t) >= limite);
}

function save() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(events), 'utf8');
  } catch (error) {
    logger.warn('[Saúde] Não foi possível salvar o histórico de coletas:', error.message);
  }
}

/**
 * Registra o resultado de um ciclo de coleta.
 *
 * @param {string} source - Nome da fonte, como aparece no relatório.
 * @param {{ read?: number, added?: number, error?: string|null }} result
 */
function recordCycle(source, result = {}) {
  load();
  events.push({
    s: String(source),
    t: Date.now(),
    r: Number(result.read) || 0,
    a: Number(result.added) || 0,
    e: result.error ? String(result.error).slice(0, 200) : null,
  });
  prune();
  save();
}

/**
 * Resume a janela por fonte: quantos ciclos, quantos falharam, quantos
 * itens foram lidos e quantas ofertas saíram.
 */
function summarize(sources = null) {
  load();
  prune();

  const porFonte = new Map();
  for (const event of events) {
    const atual = porFonte.get(event.s) || { ciclos: 0, falhas: 0, lidos: 0, enviados: 0, ultimoErro: null };
    atual.ciclos += 1;
    if (event.e) { atual.falhas += 1; atual.ultimoErro = event.e; }
    atual.lidos += event.r;
    atual.enviados += event.a;
    porFonte.set(event.s, atual);
  }

  // Fonte ligada que nunca reportou nada também precisa aparecer, senão o
  // silêncio total — o pior dos casos — passaria despercebido.
  for (const source of sources || []) {
    if (!porFonte.has(source)) {
      porFonte.set(source, { ciclos: 0, falhas: 0, lidos: 0, enviados: 0, ultimoErro: null });
    }
  }

  return [...porFonte.entries()].map(([fonte, dados]) => ({
    fonte,
    ...dados,
    saudavel: dados.ciclos > 0 && dados.falhas < dados.ciclos && dados.lidos > 0,
  })).sort((a, b) => a.fonte.localeCompare(b.fonte));
}

/**
 * Fontes que consultam sozinhas, num relógio, e portanto deveriam produzir
 * ciclos independentemente do mundo lá fora. Sem esta lista o relatório não
 * distingue "fonte desligada" de "fonte ligada que parou de responder".
 *
 * WhatsApp e Telegram ficam de fora de propósito: eles só entregam quando
 * alguém publica algo no grupo de origem. Silêncio lá é normal, e cobrar
 * atividade deles encheria o relatório de alarme falso — que é o jeito mais
 * rápido de fazer alguém parar de ler o relatório.
 */
function enabledSources() {
  const fontes = [];
  if (config.mercadoLivrePublicEnabled) fontes.push('Mercado Livre');
  if (config.itadEnabled && config.itadApiKey) fontes.push('ITAD');
  if (config.aliexpressEnabled && config.aliexpressSearches.length > 0) fontes.push('AliExpress');
  return fontes;
}

function report() {
  const horas = config.healthWindowHours;
  const linhas = summarize(enabledSources());

  logger.info(`[Saúde] Relatório das últimas ${horas}h:`);
  if (linhas.length === 0) {
    logger.warn('[Saúde] Nenhuma fonte ligada.');
    return linhas;
  }

  for (const linha of linhas) {
    const resumo = `${linha.fonte}: ${linha.ciclos} ciclo(s), ${linha.lidos} item(ns) lido(s), ${linha.enviados} oferta(s) enviada(s)`;
    if (linha.ciclos === 0) {
      logger.warn(`[Saúde] ${linha.fonte}: nenhum ciclo em ${horas}h. A fonte está ligada mas não rodou.`);
    } else if (linha.falhas === linha.ciclos) {
      logger.warn(`[Saúde] ${resumo} — todos os ciclos falharam. Último erro: ${linha.ultimoErro}`);
    } else if (linha.lidos === 0) {
      logger.warn(`[Saúde] ${resumo} — rodou mas não leu nada. Provável mudança no site da fonte.`);
    } else {
      logger.info(`[Saúde] ${resumo}.`);
      if (linha.falhas > 0) logger.warn(`[Saúde] ${linha.fonte} teve ${linha.falhas} falha(s). Último erro: ${linha.ultimoErro}`);
    }
  }
  return linhas;
}

function startHealthReport() {
  if (!config.healthReportEnabled) {
    logger.info('[Saúde] Autodiagnóstico desativado (HEALTH_REPORT_ENABLED=false).');
    return;
  }
  if (timer) return;

  load();
  logger.info(`[Saúde] Autodiagnóstico ativo: relatório a cada ${config.healthReportHours}h, janela de ${config.healthWindowHours}h.`);
  timer = setInterval(report, config.healthReportHours * 60 * 60 * 1000);
}

function stopHealthReport() {
  if (timer) clearInterval(timer);
  timer = null;
  if (loaded) save();
}

function resetForTests() {
  events = [];
  loaded = true;
}

module.exports = {
  recordCycle,
  summarize,
  enabledSources,
  report,
  startHealthReport,
  stopHealthReport,
  resetForTests,
};
