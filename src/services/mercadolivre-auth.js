const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { updateEnvFile } = require('../utils/env-file');

const AUTHORIZATION_URL = 'https://auth.mercadolivre.com.br/authorization';
const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const ENV_PATH = path.resolve(__dirname, '../../.env');

function buildAuthorizationUrl({ clientId, redirectUri, state, codeChallenge }) {
  const url = new URL(AUTHORIZATION_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

async function requestToken(parameters) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(parameters),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    const reason = payload.message || payload.error_description || payload.error || response.statusText;
    throw new Error(`Mercado Livre recusou a autenticação (${response.status}): ${reason}`);
  }

  return payload;
}

function persistTokens(payload) {
  const expiresIn = Number(payload.expires_in) || 0;
  const expiresAt = expiresIn > 0 ? Date.now() + expiresIn * 1000 : 0;

  updateEnvFile(ENV_PATH, {
    ML_ACCESS_TOKEN: String(payload.access_token),
    ML_REFRESH_TOKEN: String(payload.refresh_token || process.env.ML_REFRESH_TOKEN || ''),
    ML_TOKEN_EXPIRES_AT: String(expiresAt),
  });
}

async function exchangeAuthorizationCode({ code, codeVerifier }) {
  const payload = await requestToken({
    grant_type: 'authorization_code',
    client_id: process.env.ML_CLIENT_ID || '',
    client_secret: process.env.ML_CLIENT_SECRET || '',
    code,
    redirect_uri: process.env.ML_REDIRECT_URI || '',
    code_verifier: codeVerifier,
  });
  persistTokens(payload);
  return payload;
}

async function refreshAccessToken() {
  if (!process.env.ML_REFRESH_TOKEN) {
    throw new Error('ML_REFRESH_TOKEN não está configurado. Execute npm run auth:mercadolivre.');
  }

  const payload = await requestToken({
    grant_type: 'refresh_token',
    client_id: process.env.ML_CLIENT_ID || '',
    client_secret: process.env.ML_CLIENT_SECRET || '',
    refresh_token: process.env.ML_REFRESH_TOKEN,
  });
  persistTokens(payload);
  return payload.access_token;
}

async function getValidAccessToken() {
  const expiresAt = Number(process.env.ML_TOKEN_EXPIRES_AT) || 0;
  const expiresSoon = expiresAt === 0 || expiresAt - Date.now() < 5 * 60 * 1000;

  if (!process.env.ML_ACCESS_TOKEN || expiresSoon) {
    return refreshAccessToken();
  }
  return process.env.ML_ACCESS_TOKEN;
}

module.exports = {
  AUTHORIZATION_URL,
  TOKEN_URL,
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  refreshAccessToken,
  getValidAccessToken,
};
