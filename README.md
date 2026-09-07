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

O HTML do mockup foi separado nas rotas `/` (Linktree geral), `/links/:slug` (Linktree individual de uma casa) e `/casas/:slug` (galeria pública). A galeria mantém lightbox, compartilhamento do link, download das fotos com o nome do cômodo, contato no WhatsApp e o showroom 3D externo com vista de cima. O painel administrativo existe apenas como módulo de desenvolvimento e não é incluído no build público do GitHub Pages.

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

## Usar o painel local para atualizar o site

O painel fica disponível somente enquanto a API e a web estão rodando no seu computador, em `http://127.0.0.1:5173/#/admin`. Ele permite cadastrar casas, preencher os dados, anexar fotos, definir a capa e editar o nome de cada cômodo. O nome da legenda é usado no download da foto. O modelo 3D de cada casa também pode receber um arquivo `.glb`, ter o título e a descrição alterados, ser trocado ou removido da galeria.

Para usar pela primeira vez:

```bash
copy apps/api/.env.example apps/api/.env
npm run dev
```

Entre com a senha definida em `apps/api/.env`, crie ou edite a casa e clique em **Salvar casa**. O salvamento atualiza o catálogo local em `apps/web/src/data/houses.json`; uploads de fotos e modelos ficam em `apps/web/public/fotos` e `apps/web/public/showroom3d/modelos`.

Depois de salvar, clique em **Publicar esta casa** no card da casa desejada. Como o painel funciona localmente, a API executa o script fixo de publicação no seu computador: adiciona somente catálogo, fotos e modelos 3D, cria um commit identificado pela casa selecionada e faz o `push` para a branch atual. O GitHub Actions então reconstrói o GitHub Pages inteiro, porque o Pages sempre publica o projeto completo.

Se preferir publicar pelo PowerShell, abra-o na raiz do projeto e rode:

```powershell
.\scripts\publicar-catalogo.ps1
```

Para informar uma mensagem de commit própria:

```powershell
.\scripts\publicar-catalogo.ps1 -Message "adiciona casa nova"
```

O script prepara apenas o catálogo, as fotos e os modelos 3D. A autenticação do GitHub precisa estar configurada no Git. Alterações de código continuam usando o fluxo normal de commit e push. A publicação automática pelo botão fica desabilitada se a API estiver em produção; ela é destinada ao painel local.

Mantenha o mesmo `slug` quando quiser preservar o link do QR code. A URL pública individual usada pelo painel é `https://casasavenda.github.io/casas-a-venda/#/links/<slug>`; a galeria direta continua disponível em `https://casasavenda.github.io/casas-a-venda/#/casas/<slug>`.

O site publicado no GitHub Pages é estático: ele não publica nem conecta a API administrativa. Em produção, a API deve ser hospedada separadamente e receber `ADMIN_PASSWORD`, `ADMIN_TOKEN` e `WEB_ORIGIN` por variáveis de ambiente, nunca pelo repositório.

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
