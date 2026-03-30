FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

# Secretlar .env veya docker run -e ile verilmeli
# docker run -e NEXTAUTH_URL=... -e NEXTAUTH_SECRET=... -e DATABASE_URL=... borsa-indikator

EXPOSE 3000

CMD ["npm", "start"]
