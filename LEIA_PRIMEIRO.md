# 📖 LEIA PRIMEIRO — Mapa de Navegação

Bem-vindo ao **Bot de Promoções WhatsApp**! Este arquivo ajuda você a navegar pela documentação.

---

## 🚀 Começando Agora (Já tem número aquecido?)

Se você quer **rodar o bot em 5 minutos**:

### ➡️ Leia: [QUICK_START.md](QUICK_START.md)

```bash
# 1. Copiar configuração
cp .env.example .env

# 2. Descobrir IDs dos grupos
npm run list-groups

# 3. Preencher .env com os IDs
# (edite o arquivo e cole os IDs)

# 4. Rodar
npm start

# 5. Escanear QR Code
# Pronto!
```

**⏱️ Tempo total: 5 minutos**

---

## 📚 Entender o Funcionamento

Se você quer **entender como o bot funciona**:

### Leitura Recomendada (nessa ordem):

1️⃣ **[README.md](README.md)** ← COMEÇA AQUI
   - O que é o bot
   - Características principales
   - Anti-banimento explicado
   - Troubleshooting básico

2️⃣ **[ARCHITECTURE.md](ARCHITECTURE.md)**
   - Visão técnica detalhada
   - Cada módulo explicado
   - Fluxo de dados completo
   - Estrutura de persistência

3️⃣ **[MELHORIAS_REALIZADAS.md](MELHORIAS_REALIZADAS.md)**
   - O que foi adicionado além do planejado
   - Decisões de design
   - Comparativo antes/depois
   - Roadmap para Fase 2

---

## 🆘 Resolver Problemas

Se algo **deu errado**:

### ➡️ Leia: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

Organizado por tipo de problema:

- 🔌 **Problemas de Conexão**
- 📨 **Problemas de Detecção**
- 💰 **Problemas de Preço**
- 📊 **Problemas de Fila**
- 🔄 **Problemas de Retry**
- 🚫 **Bot Foi Banido**
- 🔐 **Autenticação**

Cada seção tem:
- Sintomas
- Causas
- Soluções passo-a-passo

---

## 📋 Checklist Rápido

### ✅ Primeiro Acesso

- [ ] Clonar/baixar projeto
- [ ] `npm install` (já feito!)
- [ ] `cp .env.example .env`
- [ ] `npm run list-groups` (obter IDs)
- [ ] Preencher `.env` com IDs
- [ ] `npm start` (rodar bot)

### ✅ Testando

- [ ] Escanear QR Code
- [ ] Bot exibe "Bot conectado e pronto para operar!"
- [ ] Enviar mensagem com link num grupo-fonte
- [ ] Observar nos logs que foi capturado
- [ ] Aguardar 2-5 minutos
- [ ] Mensagem aparece no grupo-destino ✅

### ✅ Monitoramento

- [ ] `npm run status` — ver fila
- [ ] `LOG_LEVEL=DEBUG npm start` — mais detalhes
- [ ] Observar logs para ✅ ou ❌

---

## 📁 Arquivos Importantes

### 📄 Documentação (Leia)

| Arquivo | Tempo | Use quando... |
|---------|-------|---------------|
| **QUICK_START.md** | 5 min | Quer rodar agora |
| **README.md** | 20 min | Quer entender features |
| **ARCHITECTURE.md** | 30 min | Quer saber como funciona |
| **TROUBLESHOOTING.md** | 10 min | Algo quebrou |
| **MELHORIAS_REALIZADAS.md** | 15 min | Quer saber o que foi feito |

### 🔧 Scripts (Execute)

| Script | Comando | Serve para... |
|--------|---------|---------------|
| Setup | `npm run setup` | Verificar antes de rodar |
| Status | `npm run status` | Ver estado da fila |
| Rodar | `npm start` | Iniciar bot (com verificação) |
| Rodar (rápido) | `npm run start:direct` | Iniciar bot (sem verificação) |
| Grupos | `npm run list-groups` | Descobrir IDs dos grupos |
| Teste | `npm run test:regex` | Testar sem WhatsApp |
| Dev | `npm run dev` | Modo desenvolvimento |

### 💾 Configuração

| Arquivo | Descrição |
|---------|-----------|
| `.env.example` | Exemplo de configuração |
| `.env` | Sua configuração (crie do example) |
| `src/config/index.js` | Carrega `.env` |
| `.wwebjs_auth/` | Sessão salva (não edite) |
| `.queue_backup.json` | Fila de backup (gerado automaticamente) |

### 🤖 Código (Não edite, use como referência)

| Arquivo | O que faz |
|---------|-----------|
| `index.js` | Orquestra tudo |
| `src/services/whatsapp.js` | Conecta ao WhatsApp |
| `src/services/listener.js` | Escuta mensagens |
| `src/services/affiliate.js` | Converte links |
| `src/services/queue.js` | Fila de envio |
| `src/utils/*.js` | Funções auxiliares |

---

## 🎯 Fluxo de Uso Típico

### Dia 1: Setup
```
1. Ler QUICK_START.md
2. npm run list-groups
3. Preencher .env
4. npm start
5. Escanear QR
```

### Dia 2-7: Testar
```
1. Enviar mensagens nos grupos-fonte
2. Observar bot capturar
3. Observar repostar no grupo-destino
4. Ajustar delays conforme necessário
```

### Dia 8+: Produção
```
1. Novo número SIM (aquecido)
2. npm run list-groups (com novo número)
3. Ajustar .env
4. npm start
5. Deixar rodando 24/7
```

---

## 💡 Dicas por Perfil

### 👨‍💻 Desenvolvedor (quer editar código)

1. Leia `ARCHITECTURE.md` primeiro
2. Cada módulo é independente em `src/`
3. Testes rápidos com `npm run test:regex`
4. Use `LOG_LEVEL=DEBUG` para debug
5. Mode dev: `npm run dev` (reload automático)

### 🏢 Executivo (quer apenas usar)

1. Leia `QUICK_START.md`
2. Configure conforme instruções
3. Use `npm run status` para monitorar
4. Leia `TROUBLESHOOTING.md` se algo quebrar

### 🔬 Research (quer entender anti-banimento)

1. Leia `README.md` seção "Sistema Anti-Banimento"
2. Leia `ARCHITECTURE.md` seção "Estratégias Anti-Banimento"
3. Analise código em `src/services/queue.js`
4. Veja `src/utils/delay.js` para delays

### 📊 Operações (quer monitorar 24/7)

1. Leia `README.md` seção "Logs e Monitoramento"
2. Configure `LOG_LEVEL=INFO` no `.env`
3. Use `npm run status` periodicamente
4. Rode com PM2 para background: `pm2 start index.js`

---

## 🔄 Fluxo de Aprendizado Recomendado

```
Começar
  ↓
QUICK_START.md (5 min)
  ↓
[Bot rodando!]
  ↓
README.md (20 min) — entender features
  ↓
ARCHITECTURE.md (30 min) — entender internamente
  ↓
Código em src/ (quando quiser editar)
  ↓
TROUBLESHOOTING.md (quando necessário)
```

---

## ❓ Perguntas Frequentes

### "Por onde começo?"
→ **QUICK_START.md** (5 minutos)

### "Bot não conecta, o que faço?"
→ **TROUBLESHOOTING.md** seção "Problemas de Conexão"

### "Como funciona anti-banimento?"
→ **README.md** seção "Sistema Anti-Banimento"

### "Onde configuro?"
→ **arquivo .env** (baseado em `.env.example`)

### "Como testar sem WhatsApp?"
→ `npm run test:regex`

### "Como ver o que está acontecendo?"
→ `npm run status` ou `npm start` (veja logs)

### "Quero editar o código, por onde começo?"
→ **ARCHITECTURE.md** para entender estrutura

### "Bot foi banido, e agora?"
→ **TROUBLESHOOTING.md** seção "Bot Foi Banido"

### "Como deixar rodando 24/7?"
→ **README.md** seção "Deploy em Produção"

### "Qual a próxima fase?"
→ **MELHORIAS_REALIZADAS.md** seção "Próximas Fases"

---

## 📞 Como Usar a Documentação

### 🔍 Procurar por palavra-chave

```bash
# No terminal
grep -r "sua_palavra_chave" *.md

# Exemplo:
grep -r "banido" .
```

### 🔗 Links Internos

Todos os `.md` têm links entre si. Clique para navegar.

### 📊 Visualização da Estrutura

```
QUICK_START.md (Comece aqui)
  ↓
README.md (Entender features)
  ↓
ARCHITECTURE.md (Entender internamente)
  ↓
Código src/ (Editar/modificar)
  ↓
TROUBLESHOOTING.md (Resolver problemas)
```

---

## ✨ Resumo Executivo

| Aspecto | Descrição |
|---------|-----------|
| **O que é** | Bot WhatsApp que escuta promoções e reposta com links afiliados |
| **Como funciona** | Listener → Regex → Converter → Fila → Envio com delays |
| **Anti-banimento** | Delays aleatórios 2-5 min, typing simulado, sem spam |
| **Setup** | 5 minutos com QUICK_START.md |
| **Produção** | Novo chip + 7-10 dias aquecimento + npm start |
| **Próximo passo** | Integrar APIs de afiliados (Fase 2) |

---

## 🚀 Seu Próximo Passo

### ➡️ Vá para [QUICK_START.md](QUICK_START.md) agora!

Você estará com o bot rodando em 5 minutos.

---

**Última atualização:** 2026-04-12

Boa sorte! 🎉
