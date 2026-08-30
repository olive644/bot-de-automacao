# 🔧 Guia de Troubleshooting

Soluções para problemas comuns ao usar o bot.

---

## 🆘 Checklist Rápido

```
❓ Bot não conecta?
  → Verifique: npm run status
  → Limpe cache: rm -rf .wwebjs_auth .wwebjs_cache
  → Tente: npm start

❓ Mensagens não são detectadas?
  → Execute: npm run list-groups (confirmar IDs)
  → Defina: LOG_LEVEL=DEBUG no .env
  → Teste: npm run test:regex

❓ Bot foi banido?
  → Aumente QUEUE_DELAY_MIN e QUEUE_DELAY_MAX
  → Aguarde 7-10 dias com novo número
  → "Aqueça" o número com atividade normal

❓ Fila não processa?
  → Verifique: npm run status
  → Logs: npm start (e observe os logs)
  → Reinicie: Ctrl+C e npm start

❓ Erros estranhos?
  → Log completo: LOG_LEVEL=DEBUG npm start
  → Procure por [ERROR] nos logs
  → Verifique conexão de internet
```

---

## 📋 Problemas por Categoria

---

## 🔌 Problemas de Conexão

### "Erro ao buscar chats: r"

Esse erro acontece quando o WhatsApp Web altera estruturas internas usadas pelo
`whatsapp-web.js`. Este projeto aplica automaticamente um patch compatível após
o `npm install`.

```bash
git pull
npm install
npm run list-groups
```

Se a listagem ainda não estiver disponível, mantenha o comando aberto e envie
uma mensagem no grupo desejado. O modo alternativo mostrará o ID terminado em
`@g.us` ou `@newsletter`. Copie-o para o `.env` e encerre com `Ctrl+C`.

### "Bot não conecta ao WhatsApp"

**Sintomas:**
```
[18:34:45] [INFO] Iniciando conexão com WhatsApp...
[18:34:45] [INFO] Aguardando QR Code...
[timeout — nada acontece]
```

**Soluções:**

1. **Limpar cache e sessão:**
   ```bash
   rm -rf .wwebjs_auth .wwebjs_cache
   npm start
   ```

2. **Verificar firewall/proxy:**
   - WhatsApp Web precisa de acesso a:
     - `https://web.whatsapp.com`
     - `https://chat.whatsapp.com`
   - Se estiver atrás de proxy, pode não funcionar

3. **Verificar versão do Node:**
   ```bash
   node --version  # Deve ser >= 16.0.0
   ```

4. **Reinstalar dependências:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm start
   ```

5. **Verificar espaço em disco:**
   - Puppeteer precisa de ~200MB
   - `df -h` para verificar

---

### "QR Code não aparece"

**Sintomas:**
```
[18:34:45] [INFO] Aguardando QR Code...
[nada aparece no terminal]
```

**Soluções:**

1. **Verificar se é a primeira vez:**
   - Se já tem `.wwebjs_auth/`, tenta usar sessão anterior
   - Limpe se quiser novo QR: `rm -rf .wwebjs_auth`

2. **Pode estar logado em segundo plano:**
   ```bash
   ps aux | grep node
   kill -9 [PID]  # Mate qualquer node rodando
   npm start      # Tente novamente
   ```

3. **Problema de terminal:**
   - Tente em terminal diferente
   - Aumente tamanho da janela (QR precisa de espaço)

---

### "Erro: Client is not ready yet"

**Sintomas:**
```
[ERROR] [Fila] Erro ao enviar: Client is not ready yet
```

**Significado:** Bot está tentando enviar mas não conectou completamente

**Soluções:**

1. **Aguarde o startup:**
   - Bot precisa de 10-30 segundos para conectar
   - Espere pela mensagem: `Bot conectado e pronto para operar!`

2. **Aumentar timeout:**
   ```javascript
   // No index.js, adicione delay na inicialização
   setTimeout(() => startProcessing(client), 15000)
   ```

3. **Verifique a internet:**
   - Bot precisa de conexão estável
   - Tente: `ping google.com`

---

### "Desconexão aleatória"

**Sintomas:**
```
[WARN] Bot desconectado: LOGOUT
[tentativas de reconectar...]
```

**Causas:**
- Sessão expirou
- Outro cliente fez login
- Smartphone desconectou
- Conexão de internet instável

**Soluções:**

1. **Verificar dispositivo:**
   - Verifique se o WhatsApp do celular ainda está conectado
   - Tente fechar/abrir WhatsApp

2. **Reiniciar bot:**
   ```bash
   Ctrl+C
   rm -rf .wwebjs_auth
   npm start
   ```

3. **Aumentar estabilidade:**
   - Configure com LOG_LEVEL=DEBUG
   - Procure por mensagens de erro

---

## 📨 Problemas de Detecção de Mensagens

### "Bot não detecta mensagens de grupos-fonte"

**Sintomas:**
```
[18:35:12] [Listener] Escutando 2 fonte(s) configurada(s).
[envio mensagem no grupo]
[nada acontece]
```

**Soluções:**

1. **Confirmar IDs dos grupos:**
   ```bash
   npm run list-groups
   # Copie os IDs EXATOS para SOURCE_GROUPS no .env
   ```

2. **Verificar se bot é membro:**
   - Veja se o bot aparece na lista de membros
   - Se não, adicione manualmente

3. **Testar extração de dados:**
   ```bash
   npm run test:regex
   # Veja se consegue extrair URLs
   ```

4. **Modo debug:**
   ```env
   LOG_LEVEL=DEBUG
   ```
   ```bash
   npm start
   # Verá cada mensagem recebida
   ```

5. **Verificar formato de ID:**
   - Grupos: terminam em `@g.us`
   - Canais: terminam em `@newsletter`
   - Exemplo CORRETO: `120363XXXXXXXXXX@g.us`

---

### "Bot detecta mas não envia"

**Sintomas:**
```
[Listener] URL(s) encontrada(s): 1
[Fila] Promoção adicionada
[nada mais acontece]
```

**Soluções:**

1. **Verificar DEST_GROUP:**
   ```bash
   npm run list-groups
   # Confirme que o DEST_GROUP existe e bot é membro
   ```

2. **Verificar permissões:**
   - Bot tem permissão de enviar mensagens?
   - Grupo não está mutado?

3. **Verificar fila:**
   ```bash
   npm run status
   # Vê quantas promoções estão enfileiradas
   ```

4. **Observar logs:**
   ```bash
   LOG_LEVEL=DEBUG npm start
   # Procure por [Fila] para ver progresso
   ```

---

### "URL não está sendo extraída"

**Sintomas:**
```
[Listener] Mensagem sem URL — ignorando.
```

**Mesmo que a mensagem tenha link!**

**Soluções:**

1. **Testar regex:**
   ```bash
   npm run test:regex
   # Veja se consegue extrair a URL
   ```

2. **Verificar formato da URL:**
   - Regex procura: `http://` ou `https://`
   - Exemplo OK: `https://amzn.to/ABC`
   - Exemplo ERRADO: `amzn.to/ABC` (sem https://)

3. **URL encurtada pode não ser reconhecida:**
   - Adicione ao regex em `src/utils/regex.js`:
   ```javascript
   const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+|www\.\S+/gi
   ```

4. **Teste manual:**
   ```javascript
   // No terminal Node
   const regex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi
   const text = "Confira: https://example.com"
   console.log(text.match(regex))
   ```

---

## 💰 Problemas de Preço

### "Preço não é extraído"

**Sintomas:**
```
✅ Extraído:
   • Título: "Produto"
   • URLs: 1 encontrada(s)
   (preços não aparecem)
```

**Soluções:**

1. **Formato do preço:**
   - Regex procura: `R$ XX,XX`
   - Exemplo OK: `R$ 1.299,90` ou `R$ 99,50`
   - Exemplo ERRADO: `R$99` ou `R$1299,90`

2. **Teste regex:**
   ```bash
   npm run test:regex
   # Se não aparecer preço, é problema no formato
   ```

3. **Adicionar suporte a variações:**
   ```javascript
   // Em src/utils/regex.js, adicionar:
   /R\$\s*\d+(?:[.,]\d+)?/gi  // Mais flexível
   ```

---

## 📊 Problemas de Fila

### "Fila congestionada/não processa"

**Sintomas:**
```
[Fila] Promoção adicionada. Tamanho da fila: 50
[não diminui...]
```

**Soluções:**

1. **Verificar se processador está rodando:**
   ```bash
   npm run status
   # Se tiver backup, significa fila presa
   ```

2. **Ver se há erros:**
   ```bash
   LOG_LEVEL=DEBUG npm start
   # Procure por [ERROR] na fila
   ```

3. **Reimiciar:**
   ```bash
   Ctrl+C
   npm start
   # Fila é restaurada e continua
   ```

4. **Aumentar agressividade:**
   - Se quer processar mais rápido:
   ```env
   QUEUE_DELAY_MIN=30000     # 30 segundos
   QUEUE_DELAY_MAX=60000     # 1 minuto
   ```
   - ⚠️ Risco de banimento maior!

---

### "Fila perdida após crash"

**Sintomas:**
```
[bot crashed]
npm start
[fila não foi restaurada]
```

**Soluções:**

1. **Verificar arquivo de backup:**
   ```bash
   ls -la .queue_backup.json
   cat .queue_backup.json  # Ver conteúdo
   ```

2. **Se existir:**
   - Bot deveria ter restaurado automaticamente
   - Verifique logs para erros

3. **Se não existir:**
   - Fila foi perdida durante crash
   - Não há recuperação (isso é raro)
   - Implementação é resiliente

---

## 🔄 Problemas de Retry

### "Mensagem não é enviada (muitos retries)"

**Sintomas:**
```
[Fila] ❌ Erro ao enviar (tentativa 1/3): Get chat failed
[Fila] ❌ Erro ao enviar (tentativa 2/3): ...
[Fila] ❌ Erro ao enviar (tentativa 3/3): ...
[Fila] Falhou após 3 tentativas. Descartando.
```

**Causas:**
1. Grupo-destino foi deletado/dissolvido
2. Bot foi removido do grupo
3. Bot foi banido
4. Conexão instável

**Soluções:**

1. **Verificar grupo-destino:**
   ```bash
   npm run list-groups
   # Confirme que DEST_GROUP ainda existe
   ```

2. **Verificar se bot é membro:**
   - Abra o grupo no WhatsApp
   - Veja se o bot está na lista de membros

3. **Verificar se foi banido:**
   - Tente enviar mensagem manual no grupo
   - Se não conseguir, número foi banido

4. **Aumentar delay antes de desistir:**
   ```javascript
   // Em src/services/queue.js, alterar:
   const MAX_RETRIES = 5  // de 3 para 5
   ```

---

## 🚫 Problema: Bot Foi Banido

### "Mensagens não chegam mais"

**Sintomas:**
```
[Fila] ✅ Promoção enviada (último envio bem-sucedido)
[próximas mensagens falham com erro]
```

**Confirmar banimento:**
1. Abra WhatsApp Web no navegador
2. Tente enviar manualmente para qualquer grupo
3. Se não conseguir → número foi banido

**O que fazer:**

1. **Curto prazo:**
   - Compre novo número SIM card
   - Deixe "aquecendo" por 7-10 dias:
     - Envie mensagens normais
     - Reaja a mensagens
     - Participe de conversas
   - Depois ative o bot

2. **Evitar banimento futuro:**
   - Aumente `QUEUE_DELAY_MIN` e `QUEUE_DELAY_MAX`
   - Exemplo: `QUEUE_DELAY_MIN=300000` (5 min)
   - Limite a quantidade de mensagens/dia

3. **Recuperação:**
   - WhatsApp pode desbanir após 6-12 meses
   - Mas é melhor novo número

---

## 🔐 Problemas de Autenticação

### "Erro: Session is no longer available"

**Significado:** Sessão expirou ou foi invalidada

**Soluções:**

1. **Limpar e re-autenticar:**
   ```bash
   rm -rf .wwebjs_auth .wwebjs_cache
   npm start
   # Escaneie QR Code novamente
   ```

2. **Pode acontecer quando:**
   - Você faz logout no WhatsApp Web
   - Sessão expira (~1-2 semanas)
   - WhatsApp derruba a sessão por segurança

---

### "Erro: AuthenticationFailure"

**Sintomas:**
```
[18:34:45] [ERROR] Falha na autenticação: ...
```

**Soluções:**

1. **QR Code expirou:**
   - QR é válido por ~30 segundos
   - Tente escanear mais rápido

2. **Número bloqueado:**
   - Tente fazer login manual em web.whatsapp.com
   - Se não conseguir, número foi bloqueado

3. **Re-tentar:**
   ```bash
   npm start
   # Tente novamente
   ```

---

## 📈 Performance e Recursos

### "Bot usa muita memória"

**Sintomas:**
```
ps aux | grep node
[usa 500MB+ ou continua crescendo]
```

**Soluções:**

1. **Limpar hashes de duplicata:**
   - Já é feito automaticamente (30 min)
   - Verifique em `src/services/listener.js`

2. **Limitar fila:**
   ```javascript
   // Em src/services/queue.js
   if (queue.length > 1000) {
     logger.warn('Fila muito grande!')
   }
   ```

3. **Reiniciar periodicamente:**
   ```bash
   # Via PM2
   pm2 restart whatsapp-bot
   ```

4. **Flags Puppeteer:**
   - Já estão otimizadas em `src/services/whatsapp.js`
   - `--disable-dev-shm-usage` reduz memória

---

### "CPU alta (100%)"

**Sintomas:**
```
top
[node usando 100% da CPU]
```

**Causas:**
- Fila muito grande
- Processamento infinito
- Regex ineficiente

**Soluções:**

1. **Verificar fila:**
   ```bash
   npm run status
   ```

2. **Aumentar delays:**
   - Dá tempo para processar
   ```env
   QUEUE_DELAY_MIN=300000
   ```

3. **Limpar logs:**
   - Muitas mensagens podem sobrecarregar
   ```env
   LOG_LEVEL=WARN  # Menos logs
   ```

---

## 🗑️ Limpar e Resetar

### "Resetar tudo"

Se estiver com problemas graves, limpe tudo:

```bash
# 1. Parar bot
Ctrl+C

# 2. Limpar cache e sessão
rm -rf .wwebjs_auth .wwebjs_cache .queue_backup.json

# 3. Limpar e reinstalar dependências
rm -rf node_modules package-lock.json
npm install

# 4. Re-autenticar
npm run list-groups
# Escaneie QR Code

# 5. Reconfigura .env (se perdeu)
cp .env.example .env
# Preencha com os IDs corretos

# 6. Verificar setup
npm run setup

# 7. Iniciar
npm start
```

---

## 📞 Suporte Adicional

Se nenhuma solução acima funcionar:

1. **Ativar log DEBUG:**
   ```env
   LOG_LEVEL=DEBUG
   ```
   ```bash
   npm start 2>&1 | tee bot.log
   ```

2. **Procurar por [ERROR]:**
   ```bash
   grep ERROR bot.log
   ```

3. **Procurar mensagens de timeout:**
   ```bash
   grep timeout bot.log
   grep WARN bot.log
   ```

4. **Coletar informações:**
   - Sistema: `uname -a`
   - Node: `node --version`
   - npm: `npm --version`
   - Primeiras 50 linhas do log

---

**Última atualização:** 2026-04-12
