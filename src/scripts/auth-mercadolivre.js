#!/usr/bin/env node

const crypto = require('crypto');
const { spawn } = require('child_process');
const readline = require('readline/promises');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
} = require('../services/mercadolivre-auth');

function base64Url(buffer) {
  return buffer.toString('base64url');
}

function openBrowser(url) {
  let command;
  let args;

  if (process.platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', url];
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
}

const clientId = process.env.ML_CLIENT_ID;
const clientSecret = process.env.ML_CLIENT_SECRET;
const redirectUri = process.env.ML_REDIRECT_URI;

if (!clientId || !clientSecret || !redirectUri) {
  console.error('Configure ML_CLIENT_ID, ML_CLIENT_SECRET e ML_REDIRECT_URI no .env.');
  process.exit(1);
}

const redirect = new URL(redirectUri);
if (redirect.protocol !== 'https:') {
  console.error('ML_REDIRECT_URI deve usar HTTPS, por exemplo a URL do projeto na Vercel.');
  process.exit(1);
}

const state = base64Url(crypto.randomBytes(32));
const codeVerifier = base64Url(crypto.randomBytes(64));
const codeChallenge = base64Url(crypto.createHash('sha256').update(codeVerifier).digest());
const authorizationUrl = buildAuthorizationUrl({ clientId, redirectUri, state, codeChallenge });
async function authorize() {
  console.log('Abrindo a autorização do Mercado Livre no navegador...');
  openBrowser(authorizationUrl);
  console.log('Se o navegador não abrir, copie este endereço:');
  console.log(authorizationUrl);
  console.log('\nApós autorizar, a Vercel abrirá uma página de confirmação. Copie a URL completa dessa página e cole aqui.');

  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  const callbackUrl = await terminal.question('URL de retorno: ');
  terminal.close();

  let returned;
  try {
    returned = new URL(callbackUrl.trim());
  } catch {
    throw new Error('A URL de retorno não é válida. Execute o comando novamente.');
  }

  if (returned.origin !== redirect.origin || returned.pathname !== redirect.pathname) {
    throw new Error('A URL de retorno não corresponde ao ML_REDIRECT_URI configurado.');
  }
  if (returned.searchParams.get('state') !== state) {
    throw new Error('A validação de segurança não corresponde. Execute o comando novamente.');
  }

  const error = returned.searchParams.get('error');
  const code = returned.searchParams.get('code');
  if (error || !code) {
    throw new Error('O Mercado Livre não forneceu um código de autorização.');
  }

  await exchangeAuthorizationCode({ code, codeVerifier });
  console.log('\nAutorização concluída. ML_ACCESS_TOKEN e ML_REFRESH_TOKEN foram salvos no .env.');
}

authorize().catch((error) => {
  console.error('\nFalha na autorização:', error.message);
  process.exit(1);
});
