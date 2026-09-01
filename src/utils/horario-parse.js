// ============================================
// Leitura e escrita de horário, sem depender de config.
//
// Vive separado de utils/horario.js de propósito: a configuração precisa
// converter "22:30" em minutos enquanto está sendo montada, e horario.js
// importa a configuração. Juntar os dois criaria um ciclo de importação.
// ============================================

/**
 * Converte "22:30", "22h30", "22.30" ou "22" em minutos desde a meia-noite.
 * A configuração começou aceitando só hora cheia; "22 e meia" mostrou que
 * isso não bastava.
 *
 * @returns {number|null} minutos desde a meia-noite, ou o padrão informado.
 */
function parseHorario(valor, padrao = null) {
  if (valor === undefined || valor === null || valor === '') return padrao;

  const texto = String(valor).trim();

  const comSeparador = texto.match(/^(\d{1,2})\s*[:hH.]\s*(\d{1,2})$/);
  if (comSeparador) {
    const hora = Number(comSeparador[1]);
    const minuto = Number(comSeparador[2]);
    if (hora <= 23 && minuto <= 59) return hora * 60 + minuto;
    return padrao;
  }

  const soHora = texto.match(/^(\d{1,2})$/);
  if (soHora && Number(soHora[1]) <= 23) return Number(soHora[1]) * 60;

  return padrao;
}

/**
 * "22h30" quando há minutos, "06h" quando é hora cheia.
 */
function formatarHorario(minutos) {
  if (!Number.isFinite(minutos)) return '';
  const hora = Math.floor(minutos / 60);
  const minuto = minutos % 60;
  const hh = String(hora).padStart(2, '0');
  return minuto === 0 ? `${hh}h` : `${hh}h${String(minuto).padStart(2, '0')}`;
}

module.exports = { parseHorario, formatarHorario };
