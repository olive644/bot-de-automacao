// ============================================
// Horário de silêncio.
//
// Ninguém do grupo quer notificação às 3 da manhã. Durante a janela de
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
// ============================================

const config = require('../config');

/**
 * A janela pode cruzar a meia-noite (21h às 6h), então a comparação muda
 * conforme o início seja maior ou menor que o fim.
 */
function isQuietHour(date = new Date(), inicio = config.quietHoursStart, fim = config.quietHoursEnd) {
  if (!config.quietHoursEnabled) return false;
  if (!Number.isInteger(inicio) || !Number.isInteger(fim) || inicio === fim) return false;

  const hora = date.getHours();
  // Janela que vira o dia: 21, 22, 23, 0, 1, ... 5.
  if (inicio > fim) return hora >= inicio || hora < fim;
  // Janela dentro do mesmo dia: 1 às 6.
  return hora >= inicio && hora < fim;
}

/**
 * Quanto falta, em minutos, para a janela terminar. Serve para o log dizer
 * algo útil em vez de repetir "em silêncio" a cada verificação.
 */
function minutesUntilQuietEnds(date = new Date(), fim = config.quietHoursEnd) {
  const alvo = new Date(date);
  alvo.setMinutes(0, 0, 0);
  alvo.setHours(fim);
  if (alvo <= date) alvo.setDate(alvo.getDate() + 1);
  return Math.round((alvo - date) / 60000);
}

function describeQuietWindow() {
  const doisDigitos = (h) => String(h).padStart(2, '0');
  return `${doisDigitos(config.quietHoursStart)}h às ${doisDigitos(config.quietHoursEnd)}h`;
}

module.exports = { isQuietHour, minutesUntilQuietEnds, describeQuietWindow };
