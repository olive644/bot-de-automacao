// ============================================
// Utilitário de delay aleatório
// Gera pausas humanizadas entre ações do bot
// ============================================

/**
 * Aguarda um tempo aleatório entre minMs e maxMs.
 * Retorna o tempo efetivamente aguardado (útil para logging).
 *
 * @param {number} minMs - Tempo mínimo em milissegundos
 * @param {number} maxMs - Tempo máximo em milissegundos
 * @returns {Promise<number>} - O tempo aguardado em ms
 */
function randomDelay(minMs, maxMs) {
  // Gera valor aleatório entre min e max (distribuição uniforme)
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

  return new Promise((resolve) => {
    setTimeout(() => resolve(delay), delay);
  });
}

/**
 * Formata milissegundos para leitura humana (ex: "2m 34s")
 *
 * @param {number} ms - Tempo em milissegundos
 * @returns {string}
 */
function formatMs(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

module.exports = { randomDelay, formatMs };
