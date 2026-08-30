#!/usr/bin/env node

const crypto = require('crypto');
const http = require('http');
const { spawn } = require('child_process');
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

function sendHtml(response, status, title, message) {
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
    'x-content-type-options': 'nosniff',
  });
  response.end(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui;background:#071a2f;color:#eaf7ff;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:620px;padding:36px;border:1px solid #1d6f91;border-radius:18px;background:#0b2942}h1{color:#63dcff}</style><main class="card"><h1>${title}</h1><p>${message}</p></main></html>`);
}

const clientId = process.env.ML_CLIENT_ID;
const clientSecret = process.env.ML_CLIENT_SECRET;
const redirectUri = process.env.ML_REDIRECT_URI;

if (!clientId || !clientSecret || !redirectUri) {
  console.error('Configure ML_CLIENT_ID, ML_CLIENT_SECRET e ML_REDIRECT_URI no .env.');
  process.exit(1);
}

const redirect = new URL(redirectUri);
if (redirect.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(redirect.hostname)) {
  console.error('Para o fluxo local, ML_REDIRECT_URI deve usar http://localhost ou http://127.0.0.1.');
  process.exit(1);
}

const state = base64Url(crypto.randomBytes(32));
const codeVerifier = base64Url(crypto.randomBytes(64));
const codeChallenge = base64Url(crypto.createHash('sha256').update(codeVerifier).digest());
const authorizationUrl = buildAuthorizationUrl({ clientId, redirectUri, state, codeChallenge });
const port = Number(redirect.port || 80);

let completed = false;
const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, redirect.origin);
  if (requestUrl.pathname !== redirect.pathname) {
    sendHtml(response, 404, 'Página não encontrada', 'Use o endereço de autorização exibido pelo Oli - Bot.');
    return;
  }

  if (completed) {
    sendHtml(response, 409, 'Autorização já utilizada', 'Feche esta página e volte ao terminal.');
    return;
  }
  completed = true;

  if (requestUrl.searchParams.get('state') !== state) {
    sendHtml(response, 400, 'Autorização recusada', 'A validação de segurança não corresponde. Execute o comando novamente.');
    server.close();
    return;
  }

  const error = requestUrl.searchParams.get('error');
  const code = requestUrl.searchParams.get('code');
  if (error || !code) {
    sendHtml(response, 400, 'Autorização cancelada', 'O Mercado Livre não forneceu um código de autorização.');
    server.close();
    return;
  }

  try {
    await exchangeAuthorizationCode({ code, codeVerifier });
    sendHtml(response, 200, 'Oli - Bot autorizado', 'Tokens salvos com segurança no .env local. Você já pode fechar esta página.');
    console.log('\nAutorização concluída. ML_ACCESS_TOKEN e ML_REFRESH_TOKEN foram salvos no .env.');
  } catch (exchangeError) {
    sendHtml(response, 500, 'Falha na autorização', 'Confira o terminal para ver o motivo e tente novamente.');
    console.error('\nFalha ao trocar o código por tokens:', exchangeError.message);
  } finally {
    server.close();
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`A porta ${port} já está em uso. Feche o outro programa e tente novamente.`);
  } else {
    console.error('Não foi possível iniciar o callback local:', error.message);
  }
  process.exit(1);
});

server.listen(port, redirect.hostname, () => {
  console.log('Callback local iniciado em:', redirectUri);
  console.log('Abrindo a autorização do Mercado Livre no navegador...');
  openBrowser(authorizationUrl);
  console.log('Se o navegador não abrir, copie este endereço:');
  console.log(authorizationUrl);
});

const timeout = setTimeout(() => {
  if (!completed) {
    console.error('\nTempo de autorização expirado. Execute o comando novamente.');
    server.close();
  }
}, 5 * 60 * 1000);
timeout.unref();
