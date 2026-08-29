FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p src/config/geoip

EXPOSE 8000

ENV NODE_ENV=production
ENV PORT=8000

CMD ["node", "server.js"]