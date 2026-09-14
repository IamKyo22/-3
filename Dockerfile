FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY index.html styles.css assistant.css app.js assistant.js server.mjs ./
COPY lib ./lib
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV PORT=3000
ENV AI_DATA_DIR=/app/data
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "server.mjs"]
