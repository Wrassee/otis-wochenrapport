# ===== Build Stage =====
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ===== Runtime Stage =====
FROM node:22-alpine

WORKDIR /app

# Copy installed node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code (will be overridden by volume mount in dev)
COPY package.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html ./
COPY public/ ./public/
COPY src/ ./src/

# Default environment variables
ENV VITE_RENDER_URL=http://backend:8000
ENV NODE_ENV=development

EXPOSE 5173

# Run Vite dev server with host 0.0.0.0 for container access
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
