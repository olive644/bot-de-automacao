# 🚀 Quick Start — 5 Minutos para Começar

Guia rápido para colocar o bot rodando em 5 minutos.

---

## ⏱️ Passo 1: Preparar (1 min)

```bash
cd automação
npm install
```

✅ Dependências instaladas!

---

## ⏱️ Passo 2: Descobrir IDs dos Grupos (2 min)

```bash
npm run list-groups
```

**Você verá:**
```
GRUPOS (3 encontrados):
  1. Promoções Tech
     ID: 120363111111111@g.us
  2. Deals Diversos  
     ID: 120363222222222@g.us
  3. Meu Grupo
     ID: 120363333333333@g.us

CANAIS / ABA ATUALIZAÇÕES (1 encontrado):
  1. Top Promoções
     ID: 120363444444444@newsletter
```

✅ Anote os IDs que você quer usar!

---

## ⏱️ Passo 3: Configurar `.env` (1 min)

```bash
cp .env.example .env
```

Edite `.env` e preencha:

```env
# Escolha os grupos QUE O BOT VAI OUVIR
SOURCE_GROUPS=120363111111111@g.us,120363444444444@newsletter

# Escolha o grupo ONDE O BOT VAI ENVIAR as promoções
DEST_GROUP=120363222222222@g.us

# Deixe o resto como está (já está bom!)
```

✅ Configuração pronta!

---

## ⏱️ Passo 4: Iniciar (1 min)

```bash
npm start
```

**Você verá:**
```
🔍 VERIFICANDO CONFIGURAÇÕES DO BOT
...
✅ TODAS AS VERIFICAÇÕES PASSARAM!

[18:34:22] [INFO] Iniciando conexão com WhatsApp...
[18:34:22] [INFO] Aguardando QR Code...

Escaneie o QR Code abaixo:
█████████████████████████
█ ▄▄▄▄▄ █ █ █▀▀▀▀▀ █ ▄▄▄▄▄ █
█ █   █ █ █▄▄▄ █ ▀  ▀ █ █   █
```

**Escaneie o QR Code com o seu celular!**

✅ Pronto! Bot está rodando!

---

## ⏱️ Passo 5: Testar (está feito!)

Agora você pode:

1. **Enviar uma mensagem de teste** em um dos `SOURCE_GROUPS`:
   ```
   Confira este produto: https://amzn.to/XYZABC R$ 99,90
   ```

2. **Observar os logs:**
   ```
   [18:35:12] [INFO] [Listener] Mensagem recebida em: Promoções Tech
   [18:35:12] [INFO] [Listener] URL(s) encontrada(s): 1
   [18:35:12] [INFO] [Fila] Promoção adicionada. Tamanho da fila: 1
   [18:36:45] [INFO] [Fila] ✅ Promoção enviada: "Confira este produto"
   ```

3. **Verificar no grupo-destino:**
   - Você verá a mensagem do Oli - Bot com os links originais!

✅ Tudo funcionando!

---

## 🎮 Comandos Úteis

```bash
# Iniciar bot
npm start

# Iniciar (skip verificação)
npm start:direct

# Ver status
npm run status

# Listar grupos novamente
npm run list-groups

# Testar extração (sem WhatsApp)
npm run test:regex

# Modo desenvolvimento (reload automático)
npm run dev
```

---

## ⚡ Dicas Rápidas

### 1️⃣ Bot Para Automaticamente ao Fechar

```bash
# Se quiser rodar em background, use:
npm start &

# Ou com PM2 (mais profissional):
npm install -g pm2
pm2 start index.js --name "bot"
```

### 2️⃣ Mudar Velocidade de Envio

Muito rápido? Diminua para evitar ban:

```env
QUEUE_DELAY_MIN=300000    # 5 minutos
QUEUE_DELAY_MAX=600000    # 10 minutos
```

Muito lento? Aumente:

```env
QUEUE_DELAY_MIN=60000     # 1 minuto
QUEUE_DELAY_MAX=120000    # 2 minutos
```

### 3️⃣ Ver Mais Detalhes (Debug)

```env
LOG_LEVEL=DEBUG
```

```bash
npm start  # Você verá tudo!
```

### 4️⃣ Se Bot Desconectar

```bash
Ctrl+C
npm start  # Reconnects automaticamente
```

---

## ✅ Checklist Final

- [ ] Passos 1-5 completos
- [ ] Bot mostra "Bot conectado e pronto para operar!"
- [ ] Você conseguiu obter os IDs dos grupos
- [ ] Arquivo `.env` configurado
- [ ] Testou enviando uma mensagem e recebeu resposta

---

## 🎉 Pronto!

Seu bot está pronto para usar. Próximos passos:

1. **Deixe rodando:** Bot vai capturar promoções 24/7
2. **Personalizar:** Ajuste nome, foto e delays no `.env`
3. **Monitorar:** Use `npm run status` para ver o que está acontecendo
4. **Escalabilidade:** Leia `ARCHITECTURE.md` para entender a fundo

---

## 🆘 Algo deu errado?

Verifique:

```bash
# 1. Setup
npm run setup

# 2. Status
npm run status

# 3. Testes
npm run test:regex

# 4. Logs detalhados
LOG_LEVEL=DEBUG npm start
```

Se ainda tiver problemas, leia `TROUBLESHOOTING.md`.

---

**Bom uso! 🚀**
