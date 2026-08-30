# 🏗️ Arquitetura do Bot de Promoções WhatsApp

Documentação técnica detalhada da arquitetura e fluxo de dados.

---

## 📐 Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                   WHATSAPP WEB.JS CLIENT                │
│          (Emula WhatsApp Web com Puppeteer)             │
└──────────────┬──────────────────────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
        v             v
   [Listener]    [Event: message]
        │
        ├─ Filtra grupos-fonte
        ├─ Extrai informações (regex)
        ├─ Converte links (affiliate)
        │
        v
   [Queue FIFO]
        │
        ├─ Armazena promoções
        ├─ Salva em disco (backup)
        │
        v
   [Processor]
        │
        ├─ Aguarda delay aleatório
        ├─ Simula typing
        ├─ Envia mensagem
        ├─ Retry automático
        │
        v
   [DEST_GROUP]
   (Grupo-destino)
```

---

## 📦 Módulos Principais

### 1. **config** (`src/config/index.js`)

**Responsabilidade:** Centralizar todas as configurações

```javascript
const config = {
  sourceGroups: [],      // IDs dos grupos que escuta
  destGroup: '',         // ID do grupo onde envia
  queueDelayMin: 120000, // 2 minutos
  queueDelayMax: 300000, // 5 minutos
  typingDelayMin: 3000,  // 3 segundos
  typingDelayMax: 8000,  // 8 segundos
  logLevel: 'INFO',
};
```

**Carregamento:** Via `dotenv` do arquivo `.env`

### 2. **whatsapp** (`src/services/whatsapp.js`)

**Responsabilidade:** Inicializar client e gerenciar lifecycle

**Features:**
- LocalAuth — persiste sessão em `.wwebjs_auth/`
- QR Code no terminal — primeira autenticação
- Eventos de ciclo de vida:
  - `qr` — novo QR Code
  - `authenticated` — sessão salva
  - `ready` — pronto para operar
  - `auth_failure` — falha de autenticação
  - `disconnected` — conexão perdida

**Flags Puppeteer:**
- `--no-sandbox` — necessário em alguns ambientes
- `--disable-dev-shm-usage` — reduz uso de memória
- `--disable-gpu` — melhora compatibilidade

### 3. **listener** (`src/services/listener.js`)

**Responsabilidade:** Capturar e filtrar mensagens

**Fluxo:**
```javascript
client.on('message', async (message) => {
  1. Verifica se é grupo/canal
  2. Verifica se está em SOURCE_GROUPS
  3. Extrai informações (título, preço, URL)
  4. Detecta duplicatas (evita reprocessar)
  5. Converte link para afiliado
  6. Enfileira promoção
})
```

**Detecção de Duplicatas:**
- Hash MD5 de `[texto|sender_id]`
- Rastreado por 30 minutos
- Limpa automaticamente hashes antigos

### 4. **affiliate** (`src/services/affiliate.js`)

**Responsabilidade:** Detectar plataforma e converter links

**Detecção de Plataforma:**
```javascript
const platforms = {
  'mercadolivre': ['mercadolivre.com', 'produto.mercadolivre'],
  'amazon': ['amazon.com.br', 'amzn.to'],
  'shopee': ['shopee.com.br', 'shope.ee'],
  'magazineluiza': ['magazineluiza.com', 'magalu.com'],
};
```

**Conversão (Placeholder):**
- Adiciona parâmetros `?aff_source=ID_AFILIADO`
- Estrutura pronta para integração com APIs reais

### 5. **queue** (`src/services/queue.js`)

**Responsabilidade:** Gerenciar fila FIFO com persistência

**Estrutura:**
```javascript
const queue = [];  // Array FIFO

enqueue(promo) {
  queue.push(promo)
  saveQueueToDisk()
}

async startProcessing(client) {
  while (isProcessing) {
    if (queue.length > 0) {
      const promo = queue.shift()
      await sendPromo(client, promo)
      await randomDelay(min, max)
    } else {
      await randomDelay(30s, 35s)
    }
  }
}
```

**Persistência:**
- Arquivo `.queue_backup.json` no root
- Salvo a cada `enqueue()`
- Carregado ao inicializar o módulo
- Deletado após restauração bem-sucedida

**Retry Automático:**
```javascript
// Backoff exponencial: 5s → 20s → 45s
const backoffMs = attempt² × 5000
```

**Envio:**
1. Busca chat do `DEST_GROUP`
2. Simula `sendStateTyping()` por tempo aleatório
3. `clearState()` + `sendMessage()`
4. Em caso de erro, retenta com backoff

### 6. **utils/delay** (`src/utils/delay.js`)

**Responsabilidade:** Gerar delays humanizados

```javascript
async randomDelay(minMs, maxMs) {
  const delay = Math.random() * (max - min) + min
  await new Promise(resolve => setTimeout(resolve, delay))
  return delay  // Retorna tempo efetivo para logging
}

formatMs(ms) {
  // Converte para "2m 34s" para leitura humana
}
```

### 7. **utils/regex** (`src/utils/regex.js`)

**Responsabilidade:** Extrair dados de mensagens de texto

**Regex Utilizadas:**
```javascript
URLs:     /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi
Preços:   /R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?/gi
Títulos:  Primeira linha não-URL do texto
```

**Exemplo de Extração:**
```
Input:  "iPhone 14 Pro 📱\nhttps://amzn.to/ABC\nR$ 5.299,00"

Output: {
  urls: ['https://amzn.to/ABC'],
  prices: ['R$ 5.299,00'],
  title: 'iPhone 14 Pro 📱',
  rawText: '...'
}
```

### 8. **utils/logger** (`src/utils/logger.js`)

**Responsabilidade:** Logging centralizado

**Níveis (hierárquicos):**
```javascript
DEBUG(0) < INFO(1) < WARN(2) < ERROR(3)
```

**Formato:**
```
[HH:MM:SS] [LEVEL] mensagem
```

**Configuração:** Via `LOG_LEVEL` no `.env`

---

## 🔄 Fluxo de Dados Completo

### Cenário: Mensagem com Promoção

```
1. Usuário envia mensagem no Grupo-Fonte
   └─ "iPhone com 30% OFF! https://amzn.to/ABC R$ 4.999,00"

2. Listener captura evento 'message'
   ├─ Verifica: é grupo? ✅
   ├─ Verifica: está em SOURCE_GROUPS? ✅
   ├─ Gera hash MD5 da mensagem
   ├─ Verifica: é duplicata? ❌
   └─ Marca como processado

3. extractPromoInfo() → Regex
   ├─ Title: "iPhone com 30% OFF!"
   ├─ Prices: ["R$ 4.999,00"]
   ├─ URLs: ["https://amzn.to/ABC"]
   └─ Raw: mensagem inteira

4. convertLink(url) → detectPlatform()
   ├─ Detecta: amazon.com.br
   ├─ Retorna: { original, affiliate, platform }

5. Objeto Promoção criado:
   {
     title: "iPhone com 30% OFF!",
     affiliateUrl: "https://amzn.to/ABC?tag=SEU_TAG_AMAZON",
     platform: "amazon",
     prices: ["R$ 4.999,00"],
     sourceGroup: "Grupo Fonte",
     receivedAt: "2026-04-12T18:34:45.123Z"
   }

6. enqueue(promo)
   ├─ Adiciona à queue[]
   ├─ saveQueueToDisk() → .queue_backup.json
   └─ Log: "Promoção adicionada. Tamanho: 1"

7. Fila processador (loop contínuo)
   ├─ Verifica: queue.length > 0? ✅
   ├─ Faz shift() → remove primeiro item
   └─ Chama sendPromo(client, promo)

8. sendPromo() executa:
   ├─ formatMessage(promo) → cria mensagem formatada
   ├─ chat.sendStateTyping() → "escrevendo..."
   ├─ randomDelay(3s, 8s) → simula digitação
   ├─ chat.clearState()
   ├─ chat.sendMessage(mensagem)
   └─ Log: "✅ Promoção enviada"

9. Em caso de erro (tentativa 1):
   ├─ Log: "❌ Erro ao enviar (tentativa 1/3)"
   ├─ Aguarda backoff: 5s + jitter
   └─ Retenta (até 3x)

10. Sucesso?
    ├─ Remove de queue[]
    ├─ Aguarda delay aleatório (2-5 min)
    └─ Processa próximo item

11. Fila vazia?
    ├─ Aguarda 30-35 segundos
    └─ Verifica novamente
```

---

## 🛡️ Estratégias Anti-Banimento

### 1. Delays Aleatórios
- **Entre mensagens:** 2-5 minutos (QUEUE_DELAY_MIN/MAX)
- **Jitter:** ±0-5s adicional
- **Nunca previsível:** cada espera é diferente

### 2. Simulação de Typing
- **Duração:** 3-8 segundos aleatórios
- **Antes de cada envio:** mensagens parecem "escritas"
- **Realismo:** breaks naturais na digitação

### 3. Fila Sequencial
- Nunca 2 mensagens simultâneas
- FIFO garante ordem
- Processamento lento e controlado

### 4. Comportamento Realista
- Hash de duplicatas (não reprocessa mesma msg)
- Retry com espera (não spam)
- Logging (parece atividade real)
- Erros ocasionais tratados

### 5. Taxa de Envio Baixa
- Máximo ~20 mensagens/dia (padrão)
- Facilmente ajustável via `.env`
- Progressivo (comece com delays maiores)

---

## 📊 Estrutura de Dados

### Objeto Promoção (no queue)
```javascript
{
  // Conteúdo
  title: string,              // Título extraído
  affiliateUrl: string,       // Link convertido
  platform: string,           // 'amazon', 'mercadolivre', etc
  prices: string[],           // ["R$ 99,90", "R$ 199,00"]
  rawText: string,            // Mensagem original

  // Metadata
  sourceGroup: string,        // Nome do grupo fonte
  receivedAt: ISO8601,        // Timestamp da captura
}
```

### Arquivo .queue_backup.json
```json
[
  { /* promo object 1 */ },
  { /* promo object 2 */ }
]
```

### Hash de Duplicata
```javascript
hash = MD5(messageText + senderID)
// Rastreado por 30 minutos
```

---

## 🔌 Pontos de Integração

### Com APIs de Afiliados
Arquivo `src/services/affiliate.js`:

```javascript
// TODO: Mercado Livre - API v2
case 'mercadolivre':
  const mlLink = await mercadoLivreAPI.convertLink(url, affiliateID)
  return { original: url, affiliate: mlLink, platform }

// TODO: Amazon Associates
case 'amazon':
  const amznLink = addAmazonTag(url, tagID)
  return { original: url, affiliate: amznLink, platform }
```

### Com Banco de Dados (futuro)
```javascript
// Rastrear histórico de promoções enviadas
// Índices: date, platform, group, status
```

### Com Webhooks (futuro)
```javascript
// POST to external service quando:
// - Promoção enfileirada
// - Promoção enviada
// - Erro de envio
```

---

## ⚙️ Configurações de Performance

**Otimizações Implementadas:**

1. **Puppeteer Cache**
   - `.wwebjs_cache/` — reutiliza dados
   - `--disable-dev-shm-usage` — menos memória

2. **LocalAuth**
   - `.wwebjs_auth/` — sessão persistente
   - Não precisa QR toda inicialização

3. **Limpeza de Hashes**
   - Deleta hashes com >30 min
   - Previne memory leak

4. **Fila em Memória**
   - Rápida (não precisa DB)
   - Backup em JSON (resistente a crash)

---

## 🧪 Testes

### test-regex.js
- Valida extração de dados
- Testa detecção de plataformas
- Não requer WhatsApp

### setup.js
- Verifica dependências
- Valida configuração
- Confirma estrutura

### status.js
- Monitora fila pendente
- Checa autenticação
- Resumo do estado

---

## 📈 Escalabilidade Futura

### Multi-grupos destino
```javascript
DEST_GROUPS=123@g.us,456@g.us,789@g.us
// Enviar para múltiplos destinos
```

### Filtros de conteúdo
```javascript
// Whitelist/blacklist de palavras
// Faixa de preço mínimo/máximo
// Plataformas específicas
```

### Dashboard Web
```javascript
// Express server
// WebSocket para updates em tempo real
// Gráficos de performance
```

### Banco de Dados
```javascript
// SQLite/PostgreSQL
// Histórico de promoções
// Estatísticas de envio
```

---

## 🚀 Deploy em Produção

### Via PM2
```bash
npm install -g pm2
pm2 start index.js --name "whatsapp-bot"
pm2 save
pm2 startup
```

### Via Docker
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm", "start"]
```

### Via VPS
- Ubuntu 20.04 LTS
- Node 16+
- Screen/tmux para background
- Logs em `/var/log/whatsapp-bot/`

---

**Documento atualizado:** 2026-04-12
