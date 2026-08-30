module.exports = (request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.status(200).send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Oli - Bot</title><style>body{font-family:system-ui;background:#071a2f;color:#eaf7ff;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:620px;padding:36px;border:1px solid #1d6f91;border-radius:18px;background:#0b2942}h1{color:#63dcff}code{word-break:break-all}</style><main class="card"><h1>Volte ao terminal</h1><p>Copie a URL completa desta página — incluindo tudo após <code>?</code> — e cole no comando <code>npm run auth:mercadolivre</code>.</p><p>A página não recebe tokens ou segredos. O código de autorização é temporário e só funciona junto à validação local do bot.</p></main></html>`);
};
