# Casas à Venda

Monolito modular para o catálogo público de casas, painel administrativo e showroom 3D.

## Estrutura

```text
apps/
  api/       Fastify + Zod 4, contratos HTTP e autenticação de desenvolvimento
  web/       React + Vite + React Query + React Hook Form + Tailwind + componentes base shadcn
packages/
  schemas/   contratos Zod compartilhados entre API e web
  db/       interface do repositório e adaptador em memória
showroom3d/ engine Three.js existente, servido separadamente e incorporado por iframe
```

O HTML do mockup foi separado nas rotas `/` (Linktree), `/casas/:slug` (galeria pública) e `/admin` (painel). A galeria mantém lightbox, navegação por fotos, contato no WhatsApp e o showroom 3D. O painel mantém login, criação, edição, pré-visualização e cópia do link.

## Rodar localmente

Requer Node 20+ para o ambiente atual. O repositório foi preparado para Bun workspaces; em uma máquina com Bun, use `bun install` e `bun run dev`.

```bash
npm install
npm run dev
```

Isso inicia:

- web em `http://127.0.0.1:5173`;
- API em `http://127.0.0.1:3333`;
- showroom 3D em `http://127.0.0.1:5174`.

Copie `apps/api/.env.example` para `apps/api/.env` e troque `ADMIN_PASSWORD` e `ADMIN_TOKEN` antes de qualquer uso fora do desenvolvimento. A senha padrão existe somente para facilitar o primeiro smoke test local.

## Verificações

```bash
npm run typecheck
npm run build
npm test
npm run test:showroom
```

## Próxima evolução do banco

`packages/db` hoje usa um `Map` em memória, mas expõe `HouseRepository`. O próximo passo recomendado é adicionar um adaptador PostgreSQL/Drizzle nesse pacote, mantendo os schemas e as rotas HTTP estáveis. Fotos também estão modeladas como URLs; para produção, adicione armazenamento de objetos e um endpoint multipart sem colocar arquivos dentro do banco.

## Decisões e limites atuais

- O login é uma barreira mínima para o scaffold, baseada em token configurado por ambiente; ainda não substitui sessão, rotação de tokens, rate limiting e auditoria de produção.
- O showroom 3D foi preservado como aplicação isolada porque já possui pipeline Three.js, conversão de modelos e testes próprios. A web nova somente o incorpora por URL configurável.
- O conteúdo inicial da Casa Feitoria veio do mockup e as fotos foram copiadas para `apps/web/public/fotos`.
