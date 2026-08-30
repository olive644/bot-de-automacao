const fs = require('fs');

function updateEnvFile(filePath, values) {
  const invalidValue = Object.values(values).find(
    (value) => typeof value !== 'string' || /[\r\n]/.test(value)
  );
  if (invalidValue !== undefined) {
    throw new Error('Valor inválido ao atualizar o arquivo .env.');
  }

  const original = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const lines = original.split(/\r?\n/);
  const pending = new Map(Object.entries(values));

  const updated = lines.map((line) => {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (!match || !pending.has(match[1])) return line;

    const key = match[1];
    const value = pending.get(key);
    pending.delete(key);
    return `${key}=${value}`;
  });

  if (updated.length > 0 && updated[updated.length - 1] !== '') {
    updated.push('');
  }
  for (const [key, value] of pending) {
    updated.push(`${key}=${value}`);
  }

  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${updated.join('\n').replace(/\n+$/, '')}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  fs.renameSync(tempPath, filePath);

  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }
}

module.exports = { updateEnvFile };
