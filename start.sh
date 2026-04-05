#!/bin/sh
set -e

if [ ! -d node_modules ]; then
  pnpm install --frozen-lockfile
fi

pnpm generate

exec pnpm start:dev
