// ============================================
// Guarda os arquivos de estado durante os testes.
//
// Este arquivo existe porque o mesmo erro aconteceu três vezes. Cada módulo
// novo que grava em disco — fila, histórico de preço, autodiagnóstico,
// deduplicação — passou a ser escrito pelos testes por cima do arquivo de
// produção. Numa dessas, promoções falsas com link para exemplo.com foram
// parar na fila real e uma chegou a ser enviada ao grupo.
//
// Guardar arquivo por arquivo, em cada teste, foi o que falhou. Aqui a
// lista é uma só: módulo novo com estado entra nela e todo teste que chama
// preserveState fica protegido de uma vez.
// ============================================

const fs = require('node:fs');
const path = require('node:path');

const STATE_FILES = [
  '.queue_backup.json',
  '.price_history.json',
  '.health.json',
  '.dedupe.json',
  '.aviso_noturno.json',
  '.mercadolivre_seen.json',
  '.aliexpress_seen.json',
  '.itad_seen.json',
  '.telegram_web_seen.json',
  '.telegram_offset.json',
];

/**
 * Lê o conteúdo atual de todos os arquivos de estado e agenda a devolução
 * para o fim do processo, tenha o teste passado ou falhado.
 */
function preserveState() {
  const antes = new Map();
  for (const nome of STATE_FILES) {
    const arquivo = path.resolve(__dirname, nome);
    antes.set(arquivo, fs.existsSync(arquivo) ? fs.readFileSync(arquivo, 'utf8') : null);
  }

  process.on('exit', () => {
    for (const [arquivo, conteudo] of antes) {
      try {
        if (conteudo === null) {
          if (fs.existsSync(arquivo)) fs.unlinkSync(arquivo);
        } else {
          fs.writeFileSync(arquivo, conteudo, 'utf8');
        }
      } catch (_) {
        // Falhar no encerramento esconderia o erro real do teste.
      }
    }
  });
}

module.exports = { preserveState, STATE_FILES };
