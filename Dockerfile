ARG NODE_VERSION=24.14.1-bookworm-slim
ARG PNPM_VERSION=10.32.1

FROM node:${NODE_VERSION} AS base

ARG PNPM_VERSION

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build

ARG DATABASE_URL=postgresql://docker:docker@localhost:5432/postgres?schema=public
ENV DATABASE_URL=${DATABASE_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml nest-cli.json tsconfig.json tsconfig.build.json tsconfig.spec.json prisma.config.ts ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src
COPY @types ./@types
COPY docs ./docs

RUN pnpm generate
RUN pnpm build

FROM base AS production

ENV NODE_ENV=production
ENV PORT=15003

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY config ./config
COPY --from=build /app/.prisma ./.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/modules/graphql/@generated ./src/modules/graphql/@generated

EXPOSE 15003

CMD ["node", "dist/src/main.js"]

FROM base AS development

ENV NODE_ENV=development

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml nest-cli.json tsconfig.json tsconfig.build.json tsconfig.spec.json prisma.config.ts ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src
COPY @types ./@types
COPY docs ./docs
COPY start.sh ./start.sh

RUN chmod +x /app/start.sh

EXPOSE 15003

CMD ["/bin/sh", "/app/start.sh"]
