const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildAuthorizationUrl } = require('./src/services/mercadolivre-auth');
const { updateEnvFile } = require('./src/utils/env-file');

const url = new URL(buildAuthorizationUrl({
  clientId: '123456',
  redirectUri: 'https://teste.ngrok-free.app/auth/mercadolivre/callback',
  state: 'estado-seguro',
  codeChallenge: 'desafio-pkce',
}));

assert.equal(url.origin, 'https://auth.mercadolivre.com.br');
assert.equal(url.searchParams.get('response_type'), 'code');
assert.equal(url.searchParams.get('client_id'), '123456');
assert.equal(url.searchParams.get('state'), 'estado-seguro');
assert.equal(url.searchParams.get('code_challenge'), 'desafio-pkce');
assert.equal(url.searchParams.get('code_challenge_method'), 'S256');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oli-auth-test-'));
const envPath = path.join(tempDir, '.env');
fs.writeFileSync(envPath, 'ML_ACCESS_TOKEN=antigo\nPRESERVAR=sim\n', 'utf8');
updateEnvFile(envPath, {
  ML_ACCESS_TOKEN: 'novo',
  ML_REFRESH_TOKEN: 'refresh',
});
const saved = fs.readFileSync(envPath, 'utf8');
assert.match(saved, /^ML_ACCESS_TOKEN=novo$/m);
assert.match(saved, /^ML_REFRESH_TOKEN=refresh$/m);
assert.match(saved, /^PRESERVAR=sim$/m);
fs.rmSync(tempDir, { recursive: true });

console.log('Autorização Mercado Livre: parâmetros e PKCE válidos.');
