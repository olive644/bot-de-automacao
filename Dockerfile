# ============================================
# Imagem para rodar o Oli - Bot 24h
# Serve para Railway, Render, Fly.io e qualquer VPS com Docker.
#
# A Vercel NÃO roda esta imagem: funções serverless têm duração máxima e
# não têm disco persistente, e o bot precisa de processo vivo e da pasta
# .wwebjs_auth preservada entre reinícios.
# ============================================

FROM node:22-bookworm-slim

# O Puppeteer baixa um Chrome sem as bibliotecas de sistema. Estas são as
# dependências que o Chrome headless exige no Debian slim.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
      libatk1.0-0 libatspi2.0-0 libcairo2 libcups2 libdbus-1-3 libdrm2 \
      libgbm1 libglib2.0-0 libnspr4 libnss3 libpango-1.0-0 libx11-6 \
      libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxkbcommon0 \
      libxrandr2 xdg-utils wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# O Chrome do Puppeteer fica no cache do projeto, dentro da imagem.
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY patches ./patches
RUN npm ci --omit=dev && npx puppeteer browsers install chrome

COPY . .

# Ponto de montagem do volume persistente. Sem ele a sessão do WhatsApp se
# perde a cada reinício e o QR Code precisa ser lido de novo.
VOLUME ["/app/.wwebjs_auth"]

CMD ["node", "index.js"]
