# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install production dependencies and fonts
RUN apt-get update && apt-get install -y \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client ./client
COPY --from=builder /app/schemas.yaml ./
COPY --from=builder /app/openapi.yaml ./
COPY --from=builder /app/asyncapi.yaml ./
COPY --from=builder /app/.env.local.defaults ./

ENV NODE_ENV=production
ENV PORT=3000
ENV DEPENDENCY_MODE=LIVE

EXPOSE 3000

CMD ["npm", "start"]
