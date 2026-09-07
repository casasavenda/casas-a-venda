import 'dotenv/config';
import cors from '@fastify/cors';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { createDatabase } from '@casas/db';
import {
  createHouseSchema,
  houseListSchema,
  houseSchema,
  listHousesQuerySchema,
  loginResponseSchema,
  loginSchema,
  updateHouseSchema,
} from '@casas/schemas';

const port = Number(process.env.API_PORT || 3333);
const adminPassword = process.env.ADMIN_PASSWORD || 'dev-only-change-me';
const adminToken = process.env.ADMIN_TOKEN || 'dev-token-change-me';

function sendValidationError(reply: FastifyReply, error: unknown) {
  if (error instanceof Error) {
    return reply.code(400).send({ error: 'validation_error', message: error.message });
  }
  return reply.code(400).send({ error: 'validation_error', message: 'Dados inválidos.' });
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const authorization = request.headers.authorization;
  if (authorization !== `Bearer ${adminToken}`) {
    await reply.code(401).send({ error: 'unauthorized', message: 'Faça login para continuar.' });
  }
}

export function buildServer() {
  const app = Fastify({ logger: true });
  const db = createDatabase();

  app.register(cors, { origin: true });

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
    return reply.send(houseSchema.parse(house));
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
