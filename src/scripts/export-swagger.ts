import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function fill(name: string, value: string) {
  if (!process.env[name]) {
    process.env[name] = value;
  }
}

fill('NODE_ENV', 'development');
fill('MONGODB_URI', 'mongodb://127.0.0.1:27017/vegetable_marketplace?replicaSet=rs0');
fill('JWT_ACCESS_SECRET', 'dev-access-secret-change-me');
fill('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me');
fill('FRONTEND_URL', 'http://localhost:3000');

type JsonSchema = {
  type?: string;
  example?: unknown;
  default?: unknown;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  $ref?: string;
  allOf?: JsonSchema[];
};

type Operation = {
  tags?: string[];
  summary?: string;
  parameters?: Array<{ name: string; in: string; required?: boolean; schema?: JsonSchema }>;
  requestBody?: { content?: Record<string, { schema?: JsonSchema }> };
  security?: unknown[];
};

type OpenApiDocument = {
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, JsonSchema> };
};

function resolveSchema(schema: JsonSchema | undefined, components: Record<string, JsonSchema>, depth = 0): unknown {
  if (!schema || depth > 6) {
    return {};
  }
  if (schema.$ref) {
    const name = schema.$ref.replace('#/components/schemas/', '');
    return resolveSchema(components[name], components, depth + 1);
  }
  if (schema.allOf?.length) {
    return Object.assign({}, ...schema.allOf.map((item) => resolveSchema(item, components, depth + 1)));
  }
  if (schema.example !== undefined) {
    return schema.example;
  }
  if (schema.default !== undefined) {
    return schema.default;
  }
  if (schema.enum?.length) {
    return schema.enum[0];
  }
  if (schema.type === 'object' || schema.properties) {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema.properties ?? {})) {
      if (!schema.required || schema.required.includes(key) || value.example !== undefined) {
        output[key] = resolveSchema(value, components, depth + 1);
      }
    }
    return output;
  }
  if (schema.type === 'array') {
    return [resolveSchema(schema.items, components, depth + 1)];
  }
  if (schema.type === 'integer' || schema.type === 'number') return 1;
  if (schema.type === 'boolean') return true;
  return 'string';
}

function toPostman(document: OpenApiDocument) {
  const components = document.components?.schemas ?? {};
  const folders = new Map<string, Array<Record<string, unknown>>>();
  for (const [openPath, methods] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const tag = operation.tags?.[0] ?? 'General';
      const rawUrl = `{{baseUrl}}${openPath}`;
      const query = (operation.parameters ?? [])
        .filter((parameter) => parameter.in === 'query')
        .map((parameter) => ({
          key: parameter.name,
          value: String(resolveSchema(parameter.schema, components) ?? ''),
          disabled: !parameter.required,
        }));
      const jsonSchema = operation.requestBody?.content?.['application/json']?.schema;
      const body = jsonSchema
        ? {
            mode: 'raw',
            raw: JSON.stringify(resolveSchema(jsonSchema, components), null, 2),
            options: { raw: { language: 'json' } },
          }
        : undefined;
      const item: Record<string, unknown> = {
        name: operation.summary ?? `${method.toUpperCase()} ${openPath}`,
        request: {
          method: method.toUpperCase(),
          header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
          url: {
            raw: query.length ? `${rawUrl}?${query.map((item) => item.key).join('&')}` : rawUrl,
            host: ['{{baseUrl}}'],
            path: openPath.split('/').filter(Boolean),
            query,
          },
          description: operation.summary ?? '',
          auth: operation.security?.length
            ? { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] }
            : { type: 'noauth' },
          body,
        },
      };
      if (openPath.endsWith('/auth/login')) {
        item.event = [
          {
            listen: 'test',
            script: {
              type: 'text/javascript',
              exec: [
                'const body = pm.response.json();',
                'if (body.data && body.data.accessToken) pm.collectionVariables.set("accessToken", body.data.accessToken);',
                'if (body.data && body.data.refreshToken) pm.collectionVariables.set("refreshToken", body.data.refreshToken);',
                'if (body.data && body.data.user && body.data.user._id) pm.collectionVariables.set("userId", body.data.user._id);',
              ],
            },
          },
        ];
      }
      const group = folders.get(tag) ?? [];
      group.push(item);
      folders.set(tag, group);
    }
  }
  return {
    info: {
      name: 'Farmer Wholesale Vegetable Marketplace',
      description: 'All /api/v1 endpoints. Authorize requests with the access token returned by Login.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    auth: {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
    },
    variable: [
      { key: 'baseUrl', value: 'http://localhost:5000' },
      { key: 'accessToken', value: '' },
      { key: 'refreshToken', value: '' },
      { key: 'farmerId', value: '' },
      { key: 'buyerId', value: '' },
      { key: 'listingId', value: '' },
      { key: 'offerId', value: '' },
      { key: 'orderId', value: '' },
      { key: 'marketId', value: '' },
      { key: 'cropId', value: '' },
    ],
    item: [...folders.entries()].map(([name, item]) => ({ name, item })),
  };
}

async function main() {
  await import('../routes/health');
  await import('../routes/v1');
  const { generateOpenApiDocument } = await import('../docs/swagger/registerRoute');
  const SwaggerParser = (await import('@apidevtools/swagger-parser')).default;
  const document = generateOpenApiDocument();
  await SwaggerParser.validate(document as never);
  const openapiPath = path.join(process.cwd(), 'docs', 'openapi.json');
  const postmanDir = path.join(process.cwd(), 'docs', 'postman');
  fs.mkdirSync(postmanDir, { recursive: true });
  fs.writeFileSync(openapiPath, JSON.stringify(document, null, 2));
  fs.writeFileSync(
    path.join(postmanDir, 'vegetable-marketplace.postman_collection.json'),
    JSON.stringify(toPostman(document as unknown as OpenApiDocument), null, 2),
  );
  console.log(`Wrote ${openapiPath}`);
  console.log('Wrote docs/postman/vegetable-marketplace.postman_collection.json');
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
