#!/bin/sh

echo "Aguardando o database ficar up"
until nc -z database 5432; do
  echo "database ainda down. Aguardando 5 segundos"
  sleep 5
done

echo "database disponível. Instalando dependências"
pnpm install

echo "Gerando schema prisma"
pnpm generate

echo "Executando migration do banco de dados..."
pnpm db:deploy

echo "Executando seed do banco de dados..."
pnpm db:seed

echo "Iniciando igd-agents-api"
pnpm start:dev
