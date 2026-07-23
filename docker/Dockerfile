# Imagem única da aplicação (SPEC_INFRA §2): MODE=api|worker|all|web decide o processo.
FROM oven/bun:1.3.14-slim
WORKDIR /app
# Copia o repositório inteiro (o node_modules do host é ignorado via .dockerignore) e instala
# com o workspace COMPLETO presente. Copiar só os package.json soltos quebra o linking de
# workspaces do bun (os pacotes @manypost/* não existem como fonte e o install das deps
# externas é abortado). Migrations rodam no boot da app com advisory lock.
COPY . .
RUN bun install --frozen-lockfile
# Pré-compila o frontend (Next.js) caso o container seja executado com MODE=web
RUN cd apps/web && bun run build
EXPOSE 3000
CMD ["sh", "-c", "if [ \"$MODE\" = \"web\" ]; then cd apps/web && bun run start --port ${PORT:-3000}; elif [ \"$MODE\" = \"standalone\" ] || [ \"$MODE\" = \"full\" ]; then bun run apps/worker/src/main.ts & PORT=3100 bun run apps/api/src/main.ts & PORT=${PORT:-3000} API_URL=http://localhost:3100 cd apps/web && bun run start; elif [ \"$MODE\" = \"worker\" ]; then bun run apps/worker/src/main.ts; elif [ \"$MODE\" = \"api\" ]; then bun run apps/api/src/main.ts; else bun run apps/worker/src/main.ts & bun run apps/api/src/main.ts; fi"]

