#!/bin/sh

echo "Aguardando o database ficar up"
until nc -z database 5432; do
  echo "database ainda down. Aguardando 5 segundos"
  sleep 5
done

export CI=${CI:-true}

echo "database disponível. Instalando dependências"
pnpm install --frozen-lockfile --force

echo "Gerando schema prisma"
pnpm generate

if [ -d "prisma/migrations" ] && [ "$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d | wc -l)" -gt 0 ]; then
  echo "Executando migration do banco de dados..."
  pnpm db:deploy
else
  echo "Sincronizando schema com o banco de dados (prisma db push)..."
  pnpm prisma db push
fi

echo "Executando seed do banco de dados..."
pnpm db:seed

echo "Iniciando igd-agents-api"
pnpm start:dev
