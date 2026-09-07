import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from '../src/server';

describe('API de casas', () => {
  const servers: Array<Awaited<ReturnType<typeof buildServer>>> = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  it('expõe saúde e a casa inicial', async () => {
    const server = buildServer();
    servers.push(server);

    const health = await server.inject({ method: 'GET', url: '/health' });
    const houses = await server.inject({ method: 'GET', url: '/api/v1/houses' });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: 'ok' });
    expect(houses.statusCode).toBe(200);
    expect(houses.json()).toHaveLength(1);
  });

  it('protege mutações e aceita login de desenvolvimento', async () => {
    const server = buildServer();
    servers.push(server);

    const unauthorized = await server.inject({
      method: 'POST',
      url: '/api/v1/houses',
      payload: { title: 'Sem acesso' },
    });
    const login = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { password: process.env.ADMIN_PASSWORD || 'dev-only-change-me' },
    });

    expect(unauthorized.statusCode).toBe(401);
    expect(login.statusCode).toBe(200);
    expect(login.json()).toHaveProperty('token');
  });
});
