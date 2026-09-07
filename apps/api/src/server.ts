import 'dotenv/config';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import cors from '@fastify/cors';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { casaFeitoria, createDatabase } from '@casas/db';
import {
  createHouseSchema,
  houseListSchema,
  houseSchema,
  listHousesQuerySchema,
  loginResponseSchema,
  loginSchema,
  updateHouseSchema,
  type House,
} from '@casas/schemas';

const port = Number(process.env.API_PORT || 3333);
const isProduction = process.env.NODE_ENV === 'production';
const adminPassword = process.env.ADMIN_PASSWORD || (isProduction ? '' : 'dev-only-change-me');
const adminToken = process.env.ADMIN_TOKEN || (isProduction ? '' : 'dev-token-change-me');
const webOrigin = process.env.WEB_ORIGIN || 'http://127.0.0.1:5173';
const projectRoot = resolve(process.env.PROJECT_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '../../..'));
const catalogPath = resolve(projectRoot, 'apps/web/src/data/houses.json');
const photosPath = resolve(projectRoot, 'apps/web/public/fotos');
const modelsPath = resolve(projectRoot, 'apps/web/public/showroom3d/modelos');
const publishScriptPath = resolve(projectRoot, 'scripts/publicar-catalogo.ps1');
const protectedModelFiles = new Set(['casa.glb', 'casa-direita-mobile.glb']);
const execFileAsync = promisify(execFile);

if (isProduction && (!adminPassword || !adminToken)) {
  throw new Error('ADMIN_PASSWORD e ADMIN_TOKEN são obrigatórios em produção.');
}

function readSeedCatalog(): House[] {
  try {
    const parsed = JSON.parse(readFileSync(catalogPath, 'utf8')) as unknown;
    const result = houseListSchema.safeParse(parsed);
    if (result.success) return result.data;
    console.warn('O catálogo JSON não passou na validação; usando a casa inicial.', result.error.issues);
  } catch (error) {
    console.warn('Não foi possível ler o catálogo JSON; usando a casa inicial.', error);
  }
  return [casaFeitoria];
}

async function writeCatalog(houses: House[]) {
  await writeFile(catalogPath, `${JSON.stringify(houses, null, 2)}\n`, 'utf8');
}

async function publishCatalog(message: string) {
  const powershell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  return execFileAsync(powershell, [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    publishScriptPath,
    '-Message',
    message,
  ], { cwd: projectRoot, maxBuffer: 512 * 1024 });
}

function sendValidationError(reply: FastifyReply, error: unknown) {
  if (error instanceof Error) {
    return reply.code(400).send({ error: 'validation_error', message: error.message });
  }
  return reply.code(400).send({ error: 'validation_error', message: 'Dados inválidos.' });
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const authorization = request.headers.authorization;
  if (authorization !== `Bearer ${adminToken}`) {
    return reply.code(401).send({ error: 'unauthorized', message: 'Faça login para continuar.' });
  }
}

function safeFileStem(value: string) {
  const stem = value
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return stem || 'foto';
}

function uploadedFileName(directory: string, originalName: string, extension: string) {
  const originalStem = originalName.replace(/^.*[\\/]/, '');
  const stem = safeFileStem(originalStem);
  let index = 1;
  let candidate = `${stem}${extension}`;
  while (existsSync(resolve(directory, candidate))) {
    index += 1;
    candidate = `${stem}-${index}${extension}`;
  }
  return candidate;
}

type UploadInput = { name: string; data: string };

async function uploadPhotos(files: UploadInput[]) {
  if (files.length > 20) throw new Error('Envie no máximo 20 fotos por vez.');
  await mkdir(photosPath, { recursive: true });
  const uploaded: Array<{ file: string; url: string; label: string }> = [];

  for (const file of files) {
    const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(file.data);
    if (!match) throw new Error(`O arquivo “${file.name}” não é uma imagem JPG, PNG ou WebP válida.`);
    const extension = `.${match[1].toLowerCase() === 'jpeg' ? 'jpeg' : match[1].toLowerCase()}`;
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > 10 * 1024 * 1024) {
      throw new Error(`A imagem “${file.name}” precisa ter até 10 MB.`);
    }
    const filename = uploadedFileName(photosPath, file.name, extension);
    await writeFile(resolve(photosPath, filename), buffer);
    uploaded.push({ file: filename, url: `/fotos/${filename}`, label: safeFileStem(file.name).replace(/-/g, ' ') });
  }

  return uploaded;
}

async function uploadModel(file: UploadInput) {
  const originalName = file.name.replace(/^.*[\\/]/, '');
  if (!/\.glb$/i.test(originalName)) throw new Error('O modelo 3D precisa estar no formato .glb.');
  const match = /^data:[^;]+;base64,([A-Za-z0-9+/=]+)$/i.exec(file.data);
  if (!match) throw new Error(`O arquivo “${originalName}” não é um GLB válido.`);
  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length || buffer.length > 80 * 1024 * 1024) throw new Error('O modelo 3D precisa ter até 80 MB.');
  await mkdir(modelsPath, { recursive: true });
  const filename = uploadedFileName(modelsPath, originalName, '.glb');
  await writeFile(resolve(modelsPath, filename), buffer);
  return { file: filename, url: `/showroom3d/modelos/${filename}` };
}

function modelFileFromUrl(url: string) {
  try {
    const pathname = new URL(url, 'http://127.0.0.1').pathname;
    const prefix = '/showroom3d/modelos/';
    if (!pathname.startsWith(prefix)) return null;
    const filename = basename(pathname);
    const target = resolve(modelsPath, filename);
    if (!filename || !target.startsWith(`${modelsPath}${sep}`)) return null;
    return target;
  } catch {
    return null;
  }
}

export function buildServer() {
  const app = Fastify({ logger: true, bodyLimit: 120 * 1024 * 1024 });
  const db = createDatabase(readSeedCatalog());

  app.register(cors, { origin: isProduction ? webOrigin : true });

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/api/v1/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);
    if (parsed.data.password !== adminPassword) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Senha inválida.' });
    }
    return reply.send(loginResponseSchema.parse({ token: adminToken }));
  });

  app.get('/api/v1/houses', async (request, reply) => {
    const query = listHousesQuerySchema.safeParse(request.query);
    if (!query.success) return sendValidationError(reply, query.error);
    return reply.send(houseListSchema.parse(await db.list(query.data.status)));
  });

  app.get<{ Params: { slug: string } }>('/api/v1/houses/:slug', async (request, reply) => {
    const house = await db.findBySlug(request.params.slug);
    if (!house) return reply.code(404).send({ error: 'not_found', message: 'Casa não encontrada.' });
    return reply.send(houseSchema.parse(house));
  });

  app.post('/api/v1/houses', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createHouseSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);
    if (await db.findBySlug(parsed.data.slug)) {
      return reply.code(409).send({ error: 'slug_in_use', message: 'Esse identificador já está em uso.' });
    }
    const house = await db.create(parsed.data);
    await writeCatalog(await db.list());
    return reply.code(201).send(houseSchema.parse(house));
  });

  app.patch<{ Params: { id: string } }>('/api/v1/houses/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = updateHouseSchema.safeParse({ ...(request.body as object), id: request.params.id });
    if (!parsed.success) return sendValidationError(reply, parsed.error);
    if (parsed.data.slug) {
      const duplicate = await db.findBySlug(parsed.data.slug);
      if (duplicate && duplicate.id !== request.params.id) {
        return reply.code(409).send({ error: 'slug_in_use', message: 'Esse identificador já está em uso.' });
      }
    }
    const { id, ...changes } = parsed.data;
    const house = await db.update(id, changes);
    if (!house) return reply.code(404).send({ error: 'not_found', message: 'Casa não encontrada.' });
    await writeCatalog(await db.list());
    return reply.send(houseSchema.parse(house));
  });

  app.post<{ Body: { houseId?: unknown } }>('/api/v1/admin/publish', { preHandler: requireAdmin }, async (request, reply) => {
    if (isProduction) {
      return reply.code(403).send({ error: 'forbidden', message: 'A publicação automática só está disponível no computador local.' });
    }

    if (typeof request.body?.houseId !== 'string' || !request.body.houseId) {
      return reply.code(400).send({ error: 'validation_error', message: 'Selecione uma casa para publicar.' });
    }
    const house = await db.findById(request.body.houseId);
    if (!house) {
      return reply.code(404).send({ error: 'not_found', message: 'A casa selecionada não foi encontrada.' });
    }

    try {
      const result = await publishCatalog(`publica ${house.title} (${house.slug})`);
      return reply.send({ published: true, message: result.stdout.trim() || `Casa “${house.title}” publicada com sucesso.` });
    } catch (error) {
      const commandError = error as Error & { stdout?: string; stderr?: string };
      const details = [commandError.stderr, commandError.stdout, commandError.message]
        .filter(Boolean)
        .join('\n')
        .trim();
      return reply.code(400).send({ error: 'publish_failed', message: details || 'Não foi possível publicar o catálogo.' });
    }
  });

  app.post('/api/v1/admin/uploads', { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { files?: unknown };
    if (!Array.isArray(body?.files) || !body.files.every((file) => {
      if (!file || typeof file !== 'object') return false;
      const input = file as Record<string, unknown>;
      return typeof input.name === 'string' && typeof input.data === 'string';
    })) {
      return reply.code(400).send({ error: 'validation_error', message: 'Envie uma lista de arquivos de imagem.' });
    }
    try {
      const files = await uploadPhotos(body.files as UploadInput[]);
      return reply.code(201).send({ files });
    } catch (error) {
      return reply.code(400).send({ error: 'upload_failed', message: error instanceof Error ? error.message : 'Não foi possível salvar as imagens.' });
    }
  });

  app.post('/api/v1/admin/model3d', { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { file?: unknown };
    if (!body?.file || typeof body.file !== 'object') {
      return reply.code(400).send({ error: 'validation_error', message: 'Envie um arquivo GLB.' });
    }
    const input = body.file as Record<string, unknown>;
    if (typeof input.name !== 'string' || typeof input.data !== 'string') {
      return reply.code(400).send({ error: 'validation_error', message: 'Envie um arquivo GLB válido.' });
    }
    try {
      return reply.code(201).send(await uploadModel({ name: input.name, data: input.data }));
    } catch (error) {
      return reply.code(400).send({ error: 'model_upload_failed', message: error instanceof Error ? error.message : 'Não foi possível salvar o modelo 3D.' });
    }
  });

  app.delete('/api/v1/admin/model3d', { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { url?: unknown };
    if (typeof body?.url !== 'string') return reply.code(400).send({ error: 'validation_error', message: 'Informe o arquivo 3D.' });
    const target = modelFileFromUrl(body.url);
    if (!target) return reply.code(400).send({ error: 'validation_error', message: 'Arquivo 3D inválido.' });
    if (existsSync(target) && !protectedModelFiles.has(basename(target))) await unlink(target);
    return reply.send({ deleted: true });
  });

  return app;
}

const app = buildServer();
const runningAsCli = /[\\/]server\.ts$/.test(process.argv[1] || '');

if (runningAsCli) {
  app.listen({ port, host: '127.0.0.1' }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
