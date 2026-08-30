# 🌐 Interface Web de Autenticação

Interface visual no navegador para conectar o WhatsApp ao bot de forma fácil.

---

## 🚀 Como Usar

### **Passo 1: Iniciar a Interface Web**

```bash
npm run web
```

Você verá:

```
============================================================
🌐 INTERFACE WEB INICIADA
============================================================
🔗 Abra no navegador: http://localhost:3000

📱 Instruções:
  1. Abra http://localhost:3000 no seu navegador
  2. Pegue o celular com +1(832)7076644
  3. Vá em: WhatsApp → Configurações → Aparelhos conectados
  4. Escaneie o QR Code na página

============================================================
```

### **Passo 2: Abrir no Navegador**

Abra seu navegador (Chrome, Firefox, Edge, Safari) e vá para:

```
http://localhost:3000
```

Você verá uma página bonita com:
- QR Code grande e legível
- Instruções claras
- Status em tempo real
- Botões para controlar

### **Passo 3: Conectar o Celular**

**Com o celular que tem o número +1(832)7076644:**

1. Abra **WhatsApp**
2. Vá em: **Configurações → Aparelhos conectados → Conectar aparelho**
3. **Aponte a câmera para o QR Code** na página do navegador
4. Confirme no celular

✅ **Pronto! Conectado!**

---

## 📊 O que Acontece

### Na Página do Navegador:

```
1. Status: ⏳ Aguardando QR Code...
   ↓
2. QR Code aparece grande e colorido
   ↓
3. Você escaneia com o celular
   ↓
4. Status muda para: 📱 Escaneie o QR Code com o celular
   ↓
5. Status muda para: ✅ Autenticado! Iniciando bot...
   ↓
6. Mensagem: "Bot conectado — você pode fechar esta página"
   ↓
7. Bot inicia automaticamente no terminal
```

### No Terminal:

```
[HH:MM:SS] [INFO] 🌐 INTERFACE WEB INICIADA
[HH:MM:SS] [INFO] 🔗 Abra no navegador: http://localhost:3000
[HH:MM:SS] [INFO] Conectando ao WhatsApp...
[HH:MM:SS] [INFO] QR Code gerado — acesse http://localhost:3000
[HH:MM:SS] [INFO] ✅ Autenticação bem-sucedida!
[HH:MM:SS] [INFO] ✅ Bot conectado e pronto para operar!
[HH:MM:SS] [INFO] Iniciando bot principal em 3 segundos...
[HH:MM:SS] [INFO] ✅ Bot principal iniciado!
```

---

## 🎯 Características da Interface

✅ **QR Code Grande e Nítido**
- Gerado em alta qualidade
- Fácil de escanear
- Atualiza automaticamente se expirar

✅ **Status em Tempo Real**
- Mostra o que está acontecendo
- Cores diferentes para cada etapa
- Atualiza a cada 2 segundos

✅ **Instruções Claras**
- Passo a passo visual
- Dicas úteis
- Info sobre expiração do QR

✅ **Responsivo**
- Funciona em qualquer tamanho de tela
- Bonito no PC e no tablet
- Design profissional

✅ **Controles Úteis**
- Botão "Recarregar" se algo der errado
- Botão "Fechar" para encerrar
- Auto-fecha após sucesso

---

## 🆘 Troubleshooting

### ❌ Página não abre (http://localhost:3000)

```bash
# Verificar se a porta 3000 está livra
# Se não estiver, mude a porta no código ou encerre o processo que a usa

# Tente:
npm run web
# E acesse: http://localhost:3000
```

### ❌ QR Code não aparece na página

```bash
# Recarregue a página
# Ou clique no botão "Recarregar" na página
```

### ❌ Escaneou mas nada aconteceu

```bash
# 1. Verifique se o WhatsApp está aberto no celular
# 2. Verifique se está na aba "Aparelhos conectados"
# 3. Tente escanear novamente
# 4. Clique "Recarregar" na página
```

### ❌ Erro "Falha na autenticação"

```bash
# Possíveis causas:
# 1. Número já está conectado em outro aparelho
# 2. WhatsApp foi desconectado no meio do processo
# 3. Conexão de internet caiu

# Solução:
# 1. Feche o WhatsApp Web no navegador (se estiver aberto)
# 2. Clique "Recarregar" na página
# 3. Tente escanear novamente
```

---

## 🔄 Depois da Autenticação

Após conectar com sucesso:

### 1️⃣ Feche a Página (ou aguarde auto-fechar)

A página fecha automaticamente após 5 segundos.

### 2️⃣ Configure os Grupos

No terminal ou em outra aba, execute:

```bash
npm run list-groups
```

### 3️⃣ Preencha o `.env`

Edite o arquivo `.env` com os IDs dos grupos:

```env
SOURCE_GROUPS=120363111111111@g.us,120363222222222@g.us
DEST_GROUP=120363333333333@g.us
```

### 4️⃣ Pronto!

O bot já está rodando com o número conectado!

---

## 💡 Dicas

| Dica | Detalhes |
|------|----------|
| **QR expira?** | Não se preocupe — um novo é gerado automaticamente |
| **Quer tentar novamente?** | Clique "Recarregar" na página |
| **Bot não iniciou?** | Verifique se configurou SOURCE_GROUPS e DEST_GROUP no .env |
| **Múltiplos números?** | Refaça o processo com outro número (limpe .wwebjs_auth primeiro) |

---

## 📋 Checklist

- [ ] Executei `npm run web`
- [ ] Abri http://localhost:3000 no navegador
- [ ] Vejo a página bonita com QR Code
- [ ] Pegui o celular com +1(832)7076644
- [ ] Escaneei o QR Code
- [ ] Página mostra "✅ Autenticado!"
- [ ] Terminal mostra "✅ Bot principal iniciado!"
- [ ] Fechei a página (ou ela auto-fechou)
- [ ] Configurei SOURCE_GROUPS e DEST_GROUP no .env
- [ ] Bot está rodando! 🎉

---

## 🎯 Próximo Passo

Depois da autenticação, configure os grupos:

```bash
npm run list-groups
# Copie os IDs para .env

# Edite .env com os IDs

# Pronto!
```

---

**Boa sorte! 🚀**

Perguntas? Leia `TROUBLESHOOTING.md`.
