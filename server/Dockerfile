FROM node:18-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server code
COPY server/ ./server

EXPOSE 3000

CMD ["node", "server/index.js"]
