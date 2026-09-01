// ============================================
// Horário de silêncio.
//
// Ninguém do grupo quer notificação de madrugada. Durante a janela de
// silêncio o bot não envia — e também não coleta.
//
// Não coletar é o ponto que não é óbvio. Se os coletores seguissem
// rodando, nove horas de silêncio acumulariam perto de 135 promoções, que
// levariam quase 8 horas para escoar de manhã. E não adianta guardar: uma
// oferta encontrada às 3h provavelmente já expirou às 9h. Melhor deixar o
// primeiro ciclo depois do silêncio buscar o que está valendo na hora.
//
// O listener do WhatsApp é exceção: ele depende de alguém publicar, o
// volume é pequeno e essas são as fontes que o dono escolheu a dedo.
//
// Os horários vêm da configuração já em minutos desde a meia-noite, para
// aceitar tanto "21" quanto "22:30": ver utils/horario-parse.js.
// ============================================

const config = require('../config');
const { formatarHorario } = require('./horario-parse');

function minutosDoDia(date) {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * A janela pode cruzar a meia-noite (22h30 às 6h), então a comparação muda
 * conforme o início seja maior ou menor que o fim.
 */
function isQuietHour(date = new Date(), inicio = config.quietHoursStart, fim = config.quietHoursEnd) {
  if (!config.quietHoursEnabled) return false;
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || inicio === fim) return false;

  const agora = minutosDoDia(date);
  // Janela que vira o dia: 22h30, 23h, 0h, ... 5h59.
  if (inicio > fim) return agora >= inicio || agora < fim;
  // Janela dentro do mesmo dia: 1h às 6h.
  return agora >= inicio && agora < fim;
}

/**
 * Quanto falta, em minutos, para a janela terminar. Serve para o log dizer
 * algo útil em vez de repetir "em silêncio" a cada verificação.
 */
function minutesUntilQuietEnds(date = new Date(), fim = config.quietHoursEnd) {
  const agora = minutosDoDia(date);
  const falta = fim - agora;
  return falta > 0 ? falta : falta + 24 * 60;
}

function describeQuietWindow() {
  return `${formatarHorario(config.quietHoursStart)} às ${formatarHorario(config.quietHoursEnd)}`;
}

module.exports = { isQuietHour, minutesUntilQuietEnds, describeQuietWindow };
