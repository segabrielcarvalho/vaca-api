FROM node:22.17.1-alpine AS base

RUN apk add --no-cache openssl
RUN npm install -g pnpm

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm prisma generate
RUN pnpm build

FROM base AS runtime

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY .env .env

RUN mkdir -p /app/logs
RUN mkdir -p /app/@generated

RUN chmod -R u+w /app/node_modules/.pnpm
RUN find /app/node_modules -type d -name ".prisma" -exec chmod -R u+w {} +

RUN pnpm exec prisma generate

EXPOSE 11000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD \
   node -e "require('http').get('http://localhost:11000/api/health', res => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/src/main"]

FROM runtime AS staging

ENV NODE_ENV=staging

FROM runtime AS production

ENV NODE_ENV=production

FROM base AS development

WORKDIR /app

RUN npm install -g pnpm

COPY . .

RUN chmod +x /app/start.sh

EXPOSE 5000

CMD ["/bin/sh", "/app/start.sh"]
