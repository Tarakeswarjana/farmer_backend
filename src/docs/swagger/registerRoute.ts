import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import type { RequestHandler, Router } from 'express';
import type { ZodTypeAny } from 'zod';
import { env } from '../../config/env';
import type { Role } from '../../constants/enums';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { z } from '../../openapi/setup';

export const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

export const ApiErrorSchema = z
  .object({
    success: z.literal(false),
    message: z.string().openapi({ example: 'Validation failed' }),
    error: z.object({
      code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
      details: z.array(
        z.object({
          path: z.string().optional().openapi({ example: 'quantity' }),
          message: z.string().openapi({ example: 'Quantity must be greater than 0' }),
        }),
      ),
    }),
  })
  .openapi('ApiError');

export const PaginationMetaSchema = z
  .object({
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 20 }),
    total: z.number().int().openapi({ example: 150 }),
    totalPages: z.number().int().openapi({ example: 8 }),
  })
  .openapi('Pagination');

export interface RegisteredRoute {
  method: string;
  path: string;
}

export const registeredRoutes: RegisteredRoute[] = [];
const registeredKeys = new Set<string>();

const ERRORS: Record<number, string> = {
  400: 'Validation failed',
  401: 'Authentication required',
  403: 'Forbidden for this role',
  404: 'Resource not found',
  409: 'Conflict with current resource state',
  422: 'Business rule validation failed',
  429: 'Too many requests',
  500: 'Internal server error',
};

export interface RouteConfig {
  router: Router;
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  openApiPath: string;
  tag: string;
  summary: string;
  description: string;
  auth?: boolean;
  roles?: readonly Role[];
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
  successStatus?: number;
  successSchema: ZodTypeAny;
  errors?: number[];
  beforeValidate?: RequestHandler[];
  handlers: RequestHandler[];
}

function errorContent() {
  return {
    'application/json': {
      schema: ApiErrorSchema,
    },
  };
}

export function registerRoute(config: RouteConfig): void {
  const handlers: RequestHandler[] = [];
  if (config.auth) {
    handlers.push(authenticate);
  }
  if (config.roles?.length) {
    handlers.push(authorize(...config.roles));
  }
  if (config.beforeValidate?.length) {
    handlers.push(...config.beforeValidate);
  }
  if (config.body || config.query || config.params) {
    handlers.push(validate({ body: config.body, query: config.query, params: config.params }));
  }
  handlers.push(...config.handlers);
  config.router[config.method](config.path, ...handlers);
  const routeKey = `${config.method.toUpperCase()} ${config.openApiPath}`;
  if (registeredKeys.has(routeKey)) {
    return;
  }
  registeredKeys.add(routeKey);
  registeredRoutes.push({ method: config.method.toUpperCase(), path: config.openApiPath });

  const roleText = config.roles?.length ? ` Required roles: ${config.roles.join(', ')}.` : '';
  const authText = config.auth ? ' Requires a bearer access token.' : ' Public endpoint.';
  const status = config.successStatus ?? (config.method === 'post' ? 201 : 200);
  const errorCodes = new Set<number>([400, 429, 500, ...(config.errors ?? [])]);
  if (config.auth) {
    errorCodes.add(401);
  }
  if (config.roles?.length) {
    errorCodes.add(403);
  }

  const responses: Record<string, { description: string; content: { 'application/json': { schema: ZodTypeAny } } }> = {
    [status]: {
      description: config.summary,
      content: {
        'application/json': {
          schema: config.successSchema,
        },
      },
    },
  };
  for (const code of [...errorCodes].sort((a, b) => a - b)) {
    if (code === status) {
      continue;
    }
    responses[code] = {
      description: ERRORS[code] ?? 'Error',
      content: errorContent(),
    };
  }

  registry.registerPath({
    method: config.method,
    path: config.openApiPath,
    tags: [config.tag],
    summary: config.summary,
    description: `${config.description}${authText}${roleText} Validation errors return HTTP 400 with code VALIDATION_ERROR. Business rule failures return HTTP 422 with code UNPROCESSABLE_ENTITY.`,
    security: config.auth ? [{ bearerAuth: [] }] : [],
    request: {
      params: config.params as never,
      query: config.query as never,
      body: config.body
        ? { content: { 'application/json': { schema: config.body } } }
        : undefined,
    },
    responses,
  });
}

export const API_TAGS = [
  { name: 'Authentication', description: 'Registration, login, token rotation, and verification' },
  { name: 'Users', description: 'Current user profile and password' },
  { name: 'Farmers', description: 'Farmer profiles and nearby farms' },
  { name: 'Buyers', description: 'Wholesale buyer, trader, retailer, and restaurant profiles' },
  { name: 'FPOs', description: 'Farmer Producer Organisation management' },
  { name: 'Markets', description: 'Mandis, krishak bazars, and collection centers' },
  { name: 'Crops', description: 'Vegetable master data' },
  { name: 'Listings', description: 'Farmer vegetable supply listings' },
  { name: 'Requirements', description: 'Buyer purchase requirements' },
  { name: 'Offers', description: 'Bids and negotiated offers' },
  { name: 'Orders', description: 'Order lifecycle' },
  { name: 'Payments', description: 'Provider-neutral payments, verification, refunds, and webhooks' },
  { name: 'Deliveries', description: 'Transport assignment and delivery tracking' },
  { name: 'Market Prices', description: 'Daily mandi prices' },
  { name: 'Matching', description: 'Supply and demand matching' },
  { name: 'Notifications', description: 'In-app and outbound notification records' },
  { name: 'Conversations', description: 'Buyer and farmer messages' },
  { name: 'Reviews', description: 'Ratings after completed orders' },
  { name: 'Disputes', description: 'Order disputes and resolution' },
  { name: 'Documents', description: 'Private document metadata. File bytes are stored outside MongoDB.' },
  { name: 'Admin', description: 'Administration, verification, and dashboard statistics' },
  { name: 'Health', description: 'Liveness and dependency checks' },
];

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Farmer Wholesale Vegetable Marketplace API',
      version: '1.0.0',
      description:
        'Production API for a farmer-to-wholesale vegetable marketplace focused on West Bengal, India. Prices in request and response bodies are Indian rupees with up to 2 decimal places. The service stores money as integer paise. Authenticate with POST /api/v1/auth/login and send the access token as Authorization: Bearer <token>.',
    },
    servers: [{ url: `http://localhost:${env.port}`, description: 'Local API' }],
    tags: API_TAGS,
  });
}
