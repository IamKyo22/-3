FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.html styles.css app.js server.mjs ./
COPY lib ./lib
USER node
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.mjs"]
