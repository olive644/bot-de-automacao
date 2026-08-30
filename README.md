# 🚀 Oli - Bot para Promoções no WhatsApp

O Oli - Bot escuta promoções em grupos e canais de origem e as publica em um grupo de destino, preservando todos os links exatamente como foram recebidos.

---

## 📋 Características Principais

✅ **Escuta promoções** em múltiplos grupos/canais-fonte  
✅ **Preserva todos os links originais**, sem conversão de afiliados
✅ **Imagem da promoção** — encaminha fotos recebidas com legenda
✅ **Envio espaçado** — delays aleatórios entre mensagens
✅ **Anti-banimento** — fila sequencial, jitter em todos os delays  
✅ **Persistência** — recupera promoções não enviadas após restart  
✅ **Retry automático** — tenta novamente em caso de falha (backoff exponencial)  
✅ **Detecção de duplicatas** — evita repostar a mesma promoção  
✅ **Logs detalhados** — auditoria completa de cada ação  
✅ **Setup automático** — verifica dependências antes de rodar  
✅ **Mercado Livre (opcional)** — Ofertas do Dia sem token, chave, OAuth ou navegador
✅ **ITAD para jogos de PC (opcional)** — Steam, GOG e lojas parceiras com desconto real

---

## ⚙️ Stack Tecnológico

- **Node.js** >= 16.0.0
- **whatsapp-web.js** — emulação do WhatsApp Web (menor risco de ban que Baileys)
- **Puppeteer** — headless Chrome para automação
- **dotenv** — configuração por variáveis de ambiente

---

## 🛠️ Instalação e Setup

### 1️⃣ Clonar ou Preparar o Projeto

```bash
cd automação
npm install
```

### 2️⃣ Executar Verificação de Setup

```bash
npm run setup
```

Isso verifica:
- ✅ Dependências npm instaladas
- ✅ Arquivo `.env` existe
- ✅ Configurações de `SOURCE_GROUPS` e `DEST_GROUP`
- ✅ Estrutura de diretórios

### 3️⃣ Obter IDs dos Grupos

Execute para descobrir os IDs de seus grupos/canais:

```bash
npm run list-groups
```

Isso vai exibir algo como:

```
GRUPOS (2 encontrados):
  1. Promoções Tech
     ID: 120363XXXXXXXXXX@g.us
     Participantes: 45

  2. Deals Diversos
     ID: 120363YYYYYYYYYY@g.us
     Participantes: 120

CANAIS / ABA ATUALIZAÇÕES (1 encontrado):
  1. Top Promoções
     ID: 120363ZZZZZZZZZZ@newsletter
```

### 4️⃣ Configurar `.env`

Copie `.env.example` e preencha com seus dados:

```bash
cp .env.example .env
```

Edite `.env`:

```env
# Grupos que o bot vai OUVIR (separados por vírgula)
SOURCE_GROUPS=120363XXXXXXXXXX@g.us,120363ZZZZZZZZZZ@newsletter

# Grupo onde o bot vai ENVIAR as promoções convertidas
DEST_GROUP=120363YYYYYYYYYY@g.us

# Delays anti-banimento (em milissegundos)
QUEUE_DELAY_MIN=120000      # 2 minutos mínimo
QUEUE_DELAY_MAX=300000      # 5 minutos máximo
TYPING_DELAY_MIN=3000       # 3 segundos mínimo
TYPING_DELAY_MAX=8000       # 8 segundos máximo
QUEUE_CHECK_INTERVAL=30000  # 30 segundos

# Nível de log
LOG_LEVEL=INFO  # DEBUG, INFO, WARN, ERROR

# Ofertas do Dia do Mercado Livre (sem token)
ML_PUBLIC_ENABLED=true
ML_PUBLIC_CATEGORIES=MLB1144,MLB1648
ML_PUBLIC_KEYWORDS=playstation,xbox,nintendo,controle,notebook,monitor,ssd,placa de video
ML_PUBLIC_PAGES=2
ML_PUBLIC_POLL_MINUTES=60
ML_PUBLIC_MIN_DISCOUNT=20
ML_PUBLIC_MAX_RESULTS=3
ML_PUBLIC_MAX_PER_CATEGORY=1
```

### 5️⃣ Iniciar o Bot

```bash
npm start
```

Você verá:
1. QR Code no terminal (se for a primeira vez)
2. Escaneie com o WhatsApp do seu celular
3. Bot conecta e começa a escutar

> **Dica:** Após a primeira autenticação, a sessão é salva em `.wwebjs_auth/` — não precisa escanear o QR toda vez!

---

## 🎯 Como Funciona

### Fluxo de Operação

```
Mensagem em Grupo-Fonte
    ↓
Listener: Verifica se tem URL
    ↓
Extrai: Título, Preços e todos os Links
    ↓
Enfileira Promoção
    ↓
Fila: Aguarda delay aleatório (2-5 min)
    ↓
Aplica uma pequena pausa antes do envio
    ↓
Envia no Grupo-Destino
    ↓
Aguarda delay antes do próximo (anti-banimento)
```

### Anti-Banimento

O bot implementa várias técnicas para parecer humano:

1. **Delays Aleatórios** — nunca espera o mesmo tempo (2-5 minutos entre mensagens)
2. **Pausa antes do envio** — evita disparos instantâneos em sequência
3. **Fila Sequencial** — nunca envia 2 mensagens ao mesmo tempo
4. **Jitter em Todos os Delays** — intervalos variáveis, nunca padrão
5. **Detecção de Duplicatas** — evita repostar a mesma promo
6. **Comportamento Realista** — logging, erros ocasionais, retry com espera

---

## 📁 Estrutura de Arquivos

```
automação/
├── index.js                    # Entry point
├── setup.js                    # Verificação pré-inicialização
├── package.json
├── .env.example               # Exemplo de configuração
├── .env                       # ⚠️ Seu arquivo real (gitignored)
├── .gitignore
└── src/
    ├── config/
    │   └── index.js           # Carrega .env e exporta constantes
    ├── services/
    │   ├── whatsapp.js        # Inicialização do client WA + QR
    │   ├── listener.js        # Escuta e filtra mensagens
    │   └── queue.js           # Fila com delays + retry
    ├── utils/
    │   ├── delay.js           # randomDelay() humanizado
    │   ├── regex.js           # Extração de URLs e dados
    │   └── logger.js          # Logger com timestamps
    └── scripts/
        └── list-groups.js     # Script auxiliar para descobrir IDs
```

---

## 🔧 Scripts Disponíveis

```bash
npm run setup           # Verifica configuração e dependências
npm start              # Inicia bot (roda setup antes)
npm run start:direct   # Inicia bot sem verificação (para testing)
npm run list-groups    # Lista todos os grupos/canais
npm run dev            # Modo watch (reinicia ao mudar código)
```

---

## 📊 Logs e Monitoramento

Todos os eventos são logados com timestamps. Exemplo:

```
[18:34:22] [INFO] Bot de Promoções iniciado com sucesso!
[18:34:22] [INFO] Grupos fonte: 2
[18:34:22] [INFO] Grupo destino: 120363YYYYYYYYYY@g.us
[18:34:45] [INFO] [Listener] Mensagem recebida em: Promoções Tech (grupo)
[18:34:45] [INFO] [Listener] URL(s) encontrada(s): 1
[18:34:45] [INFO] [Fila] Promoção adicionada. Tamanho da fila: 1
[18:35:12] [INFO] [Fila] Simulando digitação por 5s 234ms...
[18:35:18] [INFO] [Fila] ✅ Promoção enviada: "iPhone 14 com 30% OFF"
```

---

## 🛒 Ofertas do Dia do Mercado Livre

O Oli - Bot lê a página pública `mercadolivre.com.br/ofertas` e envia somente itens cujo preço anterior é maior que o preço atual. Não requer token, chave, conta vendedora, OAuth, Vercel nem navegador headless — é uma requisição HTTP simples.

No seu `.env`, ative e escolha as categorias que interessam ao seu grupo:

```env
ML_PUBLIC_ENABLED=true
ML_PUBLIC_CATEGORIES=MLB1144,MLB1648
ML_PUBLIC_KEYWORDS=playstation,xbox,nintendo,controle,notebook,monitor,ssd,placa de video
ML_PUBLIC_PAGES=2
ML_PUBLIC_POLL_MINUTES=60
ML_PUBLIC_MIN_DISCOUNT=20
ML_PUBLIC_MAX_RESULTS=3
ML_PUBLIC_MAX_PER_CATEGORY=1
```

IDs de categoria mais usados:

| ID | Categoria | ID | Categoria |
| --- | --- | --- | --- |
| `MLB1144` | Games | `MLB5726` | Eletrodomésticos |
| `MLB1648` | Informática | `MLB1574` | Casa e Decoração |
| `MLB1000` | Eletrônicos, Áudio e Vídeo | `MLB1276` | Esportes e Fitness |
| `MLB1051` | Celulares e Telefones | `MLB1246` | Beleza e Cuidado Pessoal |

Use `ML_PUBLIC_CATEGORIES=todas` para ler o feed inteiro, sem filtro de categoria.

`ML_PUBLIC_KEYWORDS` é opcional e filtra pelo título: uma palavra-chave casa quando **todas** as palavras dela aparecem no título, ignorando acentos e maiúsculas. Deixe vazio para aceitar qualquer oferta das categorias escolhidas.

O coletor preserva o link original do produto, só aceita descontos com preço anterior informado pela plataforma, prioriza o maior desconto, alterna a ordem das categorias a cada ciclo e lembra os itens enviados para não repetir a mesma oferta.

### Por que não existe mais busca por termo

O Mercado Livre fechou os dois caminhos que o bot usava para pesquisar palavras:

- `api.mercadolibre.com/sites/MLB/search` responde `403 forbidden` para chamadas anônimas;
- `lista.mercadolivre.com.br/<termo>` redireciona para `/gz/account-verification`, ou seja, exige login mesmo em navegador real.

A página de ofertas continua aberta e já traz o preço anterior de cada item, que é o dado necessário para calcular o desconto. Por isso a seleção passou a ser por categoria (mais palavra-chave opcional) em vez de por termo de busca. Se o Mercado Livre mudar o formato da página, o bot registra o aviso no log e mantém as demais fontes ativas.

## 🎮 Jogos de PC com ITAD

Com uma chave do [IsThereAnyDeal](https://isthereanydeal.com/apps/my/), o bot consulta promoções reais de jogos de PC e mostra a loja, o preço anterior e o atual. A chave fica somente no `.env` local:

```env
ITAD_ENABLED=true
ITAD_API_KEY=sua_chave_aqui
ITAD_COUNTRY=BR
ITAD_POLL_MINUTES=60
ITAD_MIN_DISCOUNT=1
ITAD_MIN_STEAM_REVIEWS=100
ITAD_MAX_RESULTS=3
ITAD_SHOPS=61,16,35,50
ITAD_PRIMARY_SHOPS=61,16
ITAD_EXCLUDE_BUNDLES=true
ITAD_EXCLUDE_ARABIC_TITLES=true
```

A lista `ITAD_SHOPS` também é validada dentro do bot. Fanatical é bloqueada no coletor e novamente na fila, inclusive para remover ofertas antigas restauradas do backup.

O ITAD já devolve a melhor oferta atual por jogo; o Oli - Bot prioriza Steam e Epic Games Store, aceita também GOG e Nuuvem e exclui bundles, cursos, masterclasses e títulos em árabe. A consulta usa a ordem de relevância do ITAD, aceita qualquer desconto real e exige por padrão 100 avaliações na Steam para evitar que a lista seja dominada por jogos obscuros com descontos de 95–99%. Para ampliar ou restringir o catálogo, altere `ITAD_MIN_STEAM_REVIEWS`.

Ele envia no máximo a quantidade configurada e guarda as ofertas vistas para não repetir o mesmo preço.

---

## 💾 Persistência e Recuperação

Se o bot desligar enquanto há promoções na fila:

1. **Fila é salva** em `.queue_backup.json` antes de encerrar
2. **Na próxima inicialização**, as promoções são restauradas
3. **Processamento continua** normalmente

> **Nota:** O arquivo `.queue_backup.json` é criado automaticamente e limpo após restauração.

---

## 🛡️ Tratamento de Erros

### Retry Automático com Backoff

Se uma mensagem falhar ao enviar:

- **Tentativa 1:** falha → espera 5 segundos
- **Tentativa 2:** falha → espera 20 segundos
- **Tentativa 3:** falha → espera 45 segundos
- **Após 3 falhas:** descarta promoção (log de erro)

### Conexão Perdida

Se a conexão com WhatsApp cair:

```
[19:45:00] [WARN] Bot desconectado: LOGOUT
[19:45:05] [INFO] Reconectando...
```

O cliente tenta reconectar automaticamente.

---

## 🚨 Troubleshooting

### `Erro ao buscar chats: r`

O projeto inclui um patch de compatibilidade para mudanças internas recentes do
WhatsApp Web. Atualize e reinstale as dependências antes de tentar novamente:

```bash
git pull
npm install
npm run list-groups
```

Se a listagem geral ainda falhar, o comando entra automaticamente no modo
alternativo. Envie uma mensagem no grupo desejado e copie o ID exibido no
terminal. Pressione `Ctrl+C` quando terminar.

### Bot não conecta ao WhatsApp

```bash
# 1. Verifique se o número está logado no WhatsApp Web
# 2. Limpe a cache e tente novamente
rm -rf .wwebjs_auth .wwebjs_cache
npm start
```

### Mensagens não são detectadas

```bash
# 1. Confirme os IDs dos grupos em SOURCE_GROUPS
npm run list-groups

# 2. Verifique se o bot está membro do grupo-fonte
# 3. Teste com LOG_LEVEL=DEBUG no .env
```

O bot escuta os eventos `message` e `message_create`. Ao iniciar, confira os logs `Fonte reconhecida`. Se aparecer `Fonte não encontrada`, execute novamente `npm run list-groups` e substitua o ID no `.env`.

### Bot foi banido

- ⚠️ **Aumento muito rápido?** → Aumente `QUEUE_DELAY_MIN` e `QUEUE_DELAY_MAX`
- 📞 Compre um novo número e o "aqueça" por 7-10 dias com:
  - Enviar mensagens normais
  - Reagir a mensagens
  - Participar de conversas

---

## 📝 Próximas Melhorias (Roadmap)

- [ ] Dashboard web para monitoramento em tempo real
- [ ] Whitelist/Blacklist de promoções
- [ ] Suporte a múltiplos grupos-destino
- [ ] Webhooks para notificações
- [ ] Banco de dados SQLite para histórico
- [ ] Filtros por preço/categoria

---

## 📄 Licença

MIT

---

## 💬 Suporte

Para problemas ou sugestões, verifique os logs primeiro:

```bash
LOG_LEVEL=DEBUG npm start
```

E busque no código pelos comentários `// TODO:` ou `FIXME:`.

---

**Bom uso! 🎉**
