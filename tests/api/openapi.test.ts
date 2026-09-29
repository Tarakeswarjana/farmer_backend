/// <reference path="../types.d.ts" />
import request from 'supertest';
import SwaggerParser from '@apidevtools/swagger-parser';
import listEndpoints from 'express-list-endpoints';
import { createApp } from '../../src/app';
import { registeredRoutes } from '../../src/docs/swagger/registerRoute';

function normalize(path: string): string {
  const withParams = path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
  if (withParams.length > 1 && withParams.endsWith('/')) {
    return withParams.slice(0, -1);
  }
  return withParams;
}

describe('OpenAPI', () => {
  const app = createApp();

  it('publishes a valid specification for every API route', async () => {
    const response = await request(app).get('/api-docs.json');
    expect(response.status).toBe(200);
    const document = response.body as { openapi: string; paths: Record<string, Record<string, { security?: unknown[] }>> };
    expect(document.openapi.startsWith('3.0')).toBe(true);
    await SwaggerParser.validate(document as never);

    const documented = new Set(registeredRoutes.map((route) => `${route.method} ${normalize(route.path)}`));
    const served = listEndpoints(app)
      .flatMap((endpoint) => endpoint.methods.map((method) => `${method} ${normalize(endpoint.path)}`))
      .filter((key) => key.includes('/api/v1') || key.includes('/health'));

    const missing = served.filter((key) => !documented.has(key));
    expect(missing).toEqual([]);
    expect(documented.size).toBeGreaterThan(80);

    const secured = Object.values(document.paths).flatMap((path) => Object.values(path));
    expect(secured.some((operation) => Array.isArray(operation.security) && operation.security.length > 0)).toBe(true);
    expect(document.paths['/api/v1/listings']?.post).toBeDefined();
    expect(document.paths['/api/v1/auth/login']?.post).toBeDefined();
  });
});
