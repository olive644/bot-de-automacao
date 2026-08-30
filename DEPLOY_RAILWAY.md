# 🚂 Rodando o Oli - Bot 24h no Railway

Guia do começo ao fim. O repositório já traz o `Dockerfile` e o `railway.json`, então o Railway não precisa adivinhar nada.

---

## Antes de começar

O bot precisa de duas coisas que valem repetir, porque cada uma tem um passo dedicado abaixo:

1. **Processo vivo o tempo todo** — ele mantém um Chrome aberto e uma conexão com o WhatsApp Web.
2. **Disco que sobrevive a reinício** — a pasta `.wwebjs_auth` guarda a sessão. Sem volume, cada deploy pede QR Code novo.

---

## 1. Criar o projeto

1. Entre em [railway.com](https://railway.com) e crie a conta.
2. **New Project** → **Deploy from GitHub repo** → escolha `bot-de-automacao`.
3. Autorize o Railway a ler o repositório.

O `railway.json` já diz para construir pelo `Dockerfile`, e a política de reinício é `ALWAYS` — se o bot cair, o Railway sobe de novo sozinho.

Se puder escolher a região do serviço, prefira a mais próxima do Brasil. A sessão do WhatsApp funciona de qualquer lugar, mas conectar sempre da mesma região reduz alarme do lado do WhatsApp.

---

## 2. Criar o volume — não pule este passo

No serviço criado: **Settings** → **Volumes** → **New Volume**.

**Mount path:**

```
/app/.wwebjs_auth
```

Sem isso, todo deploy apaga a sessão e o bot volta a pedir QR Code. É o erro mais comum e o mais chato de descobrir depois.

---

## 3. Configurar as variáveis

Em **Variables**, adicione as chaves do seu `.env`. Nunca comite o `.env` no repositório — o `.gitignore` já protege.

Mínimo para funcionar:

```
SOURCE_GROUPS
DEST_GROUP
```

E as das fontes que você usa:

```
ML_PUBLIC_ENABLED        ML_PUBLIC_CATEGORIES     ML_PUBLIC_KEYWORDS
ML_PUBLIC_PAGES          ML_PUBLIC_POLL_MINUTES   ML_PUBLIC_MIN_DISCOUNT
ML_PUBLIC_MAX_RESULTS    ML_PUBLIC_MAX_PER_CATEGORY

ITAD_ENABLED             ITAD_API_KEY             ITAD_COUNTRY
ITAD_POLL_MINUTES        ITAD_MIN_DISCOUNT        ITAD_MIN_STEAM_REVIEWS
ITAD_MAX_RESULTS         ITAD_SHOPS               ITAD_PRIMARY_SHOPS
ITAD_EXCLUDE_BUNDLES     ITAD_EXCLUDE_ARABIC_TITLES

TELEGRAM_ENABLED         TELEGRAM_BOT_TOKEN
TELEGRAM_SOURCE_CHATS    TELEGRAM_SEND_IMAGES

QUEUE_DELAY_MIN          QUEUE_DELAY_MAX
TYPING_DELAY_MIN         TYPING_DELAY_MAX
QUEUE_CHECK_INTERVAL     LOG_LEVEL
```

A lista completa, com explicação de cada uma, está no `.env.example`.

---

## 4. Primeiro deploy e o QR Code

Abra os **Deploy Logs**. Quando o bot subir sem sessão salva, o QR Code é desenhado no próprio log:

```
==================================================
QR CODE — aponte a câmera do WhatsApp para o desenho abaixo:
==================================================
█▀▀▀▀▀█ ▀▄█ ▀▄▀ █▀▀▀▀▀█
█ ███ █ █▀ ▄█▀▀ █ ███ █
...
```

No celular: **WhatsApp** → **Aparelhos conectados** → **Conectar aparelho** → aponte para o desenho na tela.

Depois disso o log mostra:

```
Autenticação bem-sucedida! Sessão salva localmente.
Bot conectado e pronto para operar!
```

A sessão fica no volume. Os próximos deploys sobem já conectados, sem QR.

> Se o desenho sair embaralhado, aumente a janela do navegador ou reduza o zoom: o log precisa de largura para o QR não quebrar linha.

---

## 5. Conferir que está funcionando

Nos logs, procure estas linhas:

```
[Listener] Escutando N fonte(s) configurada(s).
[Listener] Fonte reconhecida: <nome do grupo>
[Mercado Livre] Ofertas do dia: N categoria(s), ...
[ITAD] Coletor ativo para BR; ...
[Telegram] Conectado como @seu_bot.
```

`Fonte reconhecida` é a que confirma que a sessão enxerga o grupo de origem. Se aparecer `Fonte não encontrada nesta sessão`, o ID em `SOURCE_GROUPS` está errado.

---

## Duas armadilhas

**Réplicas: mantenha em 1.** Duas réplicas significam dois clientes disputando a mesma sessão do WhatsApp e dois processos lendo o mesmo bot do Telegram — este último devolve erro `409`. O padrão do Railway já é 1; só não aumente.

**Não rode o bot local e o do Railway ao mesmo tempo** com a mesma conta do WhatsApp e o mesmo token do Telegram. Escolha um dos dois.

---

## Custo

O serviço fica ligado 24h, então não há como cair no uso gratuito por inatividade. Na prática é um container pequeno; acompanhe o painel de uso do Railway no primeiro mês para calibrar.
