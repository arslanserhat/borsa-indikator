FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXTAUTH_URL=http://94.138.209.208:3000
ENV NEXTAUTH_SECRET=borsa-trading-simons-secret-2026-xK9mP2
ENV DATABASE_URL=postgresql://postgres:postgres@e-sonuc-postgres:5432/borsa_trading

EXPOSE 3000

CMD ["npm", "start"]
