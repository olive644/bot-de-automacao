// Normaliza IDs vindos do .env e do whatsapp-web.js para comparação segura.
function normalizeChatId(value) {
  const serialized = value && typeof value === 'object' ? value._serialized : value;
  return String(serialized || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toLowerCase();
}

module.exports = { normalizeChatId };
