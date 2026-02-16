FROM oven/bun:1.3-alpine AS base

WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Copy source
COPY src/ ./src/
COPY tsconfig.json ./

# Default command: run the fetcher/transformer pipeline
CMD ["bun", "run", "src/index.ts"]
