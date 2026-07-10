# Imagem única do backend (SPEC_INFRA §2): MODE=api|worker|all decide o processo.
FROM oven/bun:1-slim AS deps
WORKDIR /app
COPY package.json bun.lock* ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY packages/contracts/package.json packages/contracts/
COPY packages/core/package.json packages/core/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/providers/package.json packages/providers/
RUN bun install --frozen-lockfile || bun install

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Migrations rodam no entrypoint com advisory lock (fase 0: implementar em packages/db)
EXPOSE 3000
CMD ["sh", "-c", "if [ \"$MODE\" = \"worker\" ]; then bun run apps/worker/src/main.ts; elif [ \"$MODE\" = \"api\" ]; then bun run apps/api/src/main.ts; else bun run apps/worker/src/main.ts & bun run apps/api/src/main.ts; fi"]
