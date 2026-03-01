# VACA API

API GraphQL desenvolvida com NestJS para o projeto VACA (Virtual Assistant for Cognitive Activities). Esta aplicação fornece serviços backend para gerenciamento de usuários, autenticação, armazenamento de arquivos e integração com serviços de IA.

## 🚀 Tecnologias

- **Framework**: [NestJS](https://nestjs.com/)
- **Linguagem**: TypeScript
- **Database**: PostgreSQL com [Prisma ORM](https://prisma.io/)
- **API**: GraphQL com Apollo Server
- **Cache/Queue**: Redis e BullMQ
- **Autenticação**: JWT com Passport
- **Storage**: AWS S3 (LocalStack para desenvolvimento)
- **IA**: OpenAI API integration
- **Email**: SendGrid
- **Upload**: Suporte a upload de arquivos
- **WebSockets**: GraphQL Subscriptions

## 📋 Pré-requisitos

- Node.js (versão 22+)
- pnpm
- PostgreSQL
- Redis
- Docker e Docker Compose (opcional)

## ⚙️ Configuração do Ambiente

1. **Clone o repositório**

   ```bash
   git clone https://github.com/segabrielcarvalho/vaca-api.git
   cd vaca-api
   ```

2. **Instale as dependências**

   ```bash
   pnpm install
   ```

3. **Configure as variáveis de ambiente**

   ```bash
   cp .env.example .env
   ```

   Edite o arquivo `.env` com suas configurações:
   - `DATABASE_URL`: URL de conexão com PostgreSQL
   - `REDIS_HOST` e `REDIS_PORT`: Configurações do Redis
   - `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET`: Chaves para JWT
   - Configurações de storage (AWS S3 ou LocalStack)
   - Chaves de API (OpenAI, SendGrid, etc.)

4. **Configure o banco de dados**

   ```bash
   # Gerar o cliente Prisma
   pnpm prisma generate

   # Executar migrations
   pnpm db:migrate

   # Popular o banco com dados iniciais (opcional)
   pnpm db:seed
   ```

## 🚀 Executando a Aplicação

```bash
# Modo desenvolvimento
pnpm run start:dev

# Modo desenvolvimento com debug
pnpm run start:debug

# Modo produção
pnpm run build
pnpm run start:prod
```

A aplicação estará disponível em `http://localhost:11000/graphql` (GraphQL Playground)

## 🐳 Executando com Docker

```bash
# Build da imagem
docker build -t vaca-api .

# Executar container
docker run -p 11000:11000 --env-file .env vaca-api
```

## 📊 Banco de Dados

### Comandos Prisma úteis

```bash
# Reset completo do banco
pnpm db:reset

# Push do schema para o banco (desenvolvimento)
pnpm db:push

# Executar seed
pnpm db:seed

# Deploy de migrations (produção)
pnpm db:deploy

# Abrir Prisma Studio
pnpm studio
```

## 🧪 Testes

```bash
# Testes unitários
pnpm run test

# Testes em modo watch
pnpm run test:watch

# Testes e2e
pnpm run test:e2e

# Cobertura de testes
pnpm run test:cov
```

## 📁 Estrutura do Projeto

```
src/
├── modules/
│   ├── app/           # Configuração principal da aplicação
│   ├── auth/          # Autenticação e autorização
│   ├── graphql/       # Configuração GraphQL e schemas
│   ├── prisma/        # Configuração do Prisma ORM
│   ├── queue/         # Filas de processamento com BullMQ
│   ├── redis/         # Configuração do Redis
│   ├── storage/       # Gerenciamento de arquivos (S3/LocalStack)
│   └── user/          # Gerenciamento de usuários
├── types/             # Definições de tipos TypeScript
├── utils/             # Utilitários compartilhados
└── main.ts           # Ponto de entrada da aplicação
```

## 🔧 Principais Funcionalidades

### Autenticação e Autorização

- Login/logout com JWT
- Diferentes níveis de acesso (admin, user, mentee)
- Autenticação por email com código de verificação
- Proteção de rotas com guards personalizados

### GraphQL API

- Schema-first approach
- Subscriptions em tempo real via WebSockets
- Upload de arquivos
- Paginação e filtros

### Gerenciamento de Arquivos

- Upload para S3 ou LocalStack
- Suporte a múltiplos tipos de arquivo
- URLs pré-assinadas para acesso seguro

### Integração com IA

- Integração com OpenAI API
- Processamento de documentos (PDF)
- Análise de conteúdo com IA

### Sistema de Filas

- Processamento assíncrono com BullMQ
- Dashboard para monitoramento de filas
- Tasks em background

## 🔐 Variáveis de Ambiente

### Servidor

- `PORT`: Porta da aplicação (default: 11000)
- `BASE_API_URL`: URL base da API
- `BASE_WEB_URL`: URL base do frontend
- `NODE_ENV`: Ambiente de execução

### Autenticação

- `JWT_ACCESS_SECRET`: Chave secreta para JWT de acesso
- `JWT_ACCESS_EXPIRES_IN`: Tempo de expiração do token de acesso
- `JWT_REFRESH_SECRET`: Chave secreta para JWT de refresh
- `JWT_REFRESH_EXPIRES_IN`: Tempo de expiração do token de refresh

### Banco de Dados

- `DATABASE_URL`: URL de conexão com PostgreSQL

### Redis

- `REDIS_HOST`: Host do Redis
- `REDIS_PORT`: Porta do Redis
- `REDIS_PASSWORD`: Senha do Redis (opcional)
- `REDIS_USERNAME`: Usuário do Redis (opcional)

### Storage (S3/LocalStack)

- `STORAGE_ENVIRONMENT`: Tipo de storage (local/cloud)
- `STORAGE_ENDPOINT`: Endpoint do S3/LocalStack
- `STORAGE_BUCKET`: Nome do bucket
- `STORAGE_REGION`: Região AWS
- `AWS_ACCESS_KEY_ID`: Chave de acesso AWS
- `AWS_SECRET_ACCESS_KEY`: Chave secreta AWS

## 🛠️ Scripts Disponíveis

```bash
# Desenvolvimento
pnpm start:dev          # Inicia em modo desenvolvimento
pnpm start:debug        # Inicia com debug habilitado

# Build e Produção
pnpm build              # Compila o projeto
pnpm start:prod         # Inicia em modo produção

# Banco de Dados
pnpm db:reset           # Reset completo do banco
pnpm db:push            # Push do schema + seed
pnpm db:seed            # Executa apenas o seed
pnpm db:migrate         # Executa migrations
pnpm db:deploy          # Deploy de migrations (produção)
pnpm studio             # Abre Prisma Studio

# Código
pnpm format             # Formata código com Prettier
pnpm lint               # Executa ESLint

# Prisma
pnpm generate           # Gera cliente Prisma
```

## 🏥 Health Check

A aplicação possui um endpoint de health check disponível em `/api/health` que pode ser usado para monitoramento e verificações de status.

## 📚 Documentação da API

Acesse `http://localhost:11000/graphql` para visualizar o GraphQL Playground com toda a documentação da API, schemas disponíveis e possibilidade de testar queries e mutations interativamente.

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request
