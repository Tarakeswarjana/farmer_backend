# Farmer–Wholesale Vegetable Marketplace API

Production-oriented backend for a farmer-to-wholesale vegetable marketplace focused on West Bengal, India, especially Kolkata and North 24 Parganas.

Farmers publish available vegetables. Buyers search supply, compare mandi prices, and either bid or buy at the listed price. Accepting an offer reserves quantity and creates an order in one MongoDB transaction. Payment, pickup, delivery, and reviews follow that order.

## Architecture

```text
Route
  → authentication and role checks
  → Zod validation
  → thin controller
  → service (business rules)
  → repository (database access)
  → Mongoose model
  → MongoDB
```

HTTP handlers live under `/api/v1`. A later `/api/v2` can be added beside `src/routes/v1` without rewriting the domain services.

```text
src/
  config/          environment, MongoDB, Redis, OpenAPI
  controllers/     request and response mapping
  services/        business rules
  repositories/    database queries
  models/          Mongoose schemas and indexes
  routes/v1/       versioned HTTP routes
  middlewares/     auth, validation, errors, uploads, rate limits
  validators/      Zod schemas shared with OpenAPI
  providers/       payment, storage, and notification adapters
  jobs/            expiry, reminders, and daily statistics
  events/          domain events for notifications
  scripts/         seed data and OpenAPI export
```

## Technology stack

Node.js, TypeScript, Express, MongoDB, Mongoose, JWT, bcrypt, Redis, BullMQ, Zod, Swagger/OpenAPI 3, Pino, Helmet, CORS, rate limiting, compression, Jest, and Supertest.

Money is stored as integer paise. API request and response prices are rupees with at most two decimal places.

## Installation

```bash
npm install
cp .env.example .env
npm run db:up
npm run dev
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
npm install
npm run db:up
npm run dev
```

The API listens on port 5000 by default.

Swagger UI: [http://localhost:5000/api-docs](http://localhost:5000/api-docs)

OpenAPI JSON: [http://localhost:5000/api-docs.json](http://localhost:5000/api-docs.json)

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port |
| `NODE_ENV` | `development`, `test`, or `production` |
| `MONGODB_URI` | MongoDB connection string. Transactions require a replica set |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRES_IN` | Access token |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | Refresh token |
| `REDIS_URL` | Optional. Enables shared rate-limit storage and BullMQ |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `AWS_S3_BUCKET` | Optional S3 storage. Local disk is used when these are empty |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | Optional email. Email is skipped when unset |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Optional Razorpay. The Razorpay method uses a local mock provider when unset |
| `FRONTEND_URL` | Allowed CORS origin |
| `LOG_LEVEL` | `error`, `warn`, `info`, or `debug` |

Do not commit `.env`. Passwords, JWTs, refresh tokens, OTPs, bank account numbers, and document bytes are never written to logs.

## MongoDB setup

Transactions (accept offer, create order, reserve quantity, payment webhook) need a replica set.

On this machine, `npm run db:up` starts a single-node replica set on port **27018** (port 27017 is already used by the standalone Windows MongoDB service). The default `.env` URI is:

```text
mongodb://127.0.0.1:27018/vegetable_marketplace?replicaSet=rs0
```

Docker Desktop can also provide MongoDB and Redis:

```bash
docker compose up -d mongo redis mongo-init
```

That Docker Mongo listens on 27017. Point `MONGODB_URI` at that port if you use Compose.

Geospatial queries use `2dsphere` indexes on farmer, buyer, market, and listing locations. Coordinates are GeoJSON `[longitude, latitude]`.

## Redis setup

Redis is optional. Without `REDIS_URL` the API still runs: rate limits stay in memory and background jobs use an interval instead of BullMQ.

```bash
redis-server
```

## Running locally

```bash
npm run dev
```

Phone and email verification codes are returned as `debugCode` when `NODE_ENV` is not `production`. SMS, WhatsApp, and push providers are skip-channels until real credentials and adapters are added.

## Running tests

```bash
npm test
```

Tests use an in-memory MongoDB replica set, so no local database is required. `npm run test:watch` reruns them.

## Swagger documentation

```bash
npm run swagger
```

This writes `docs/openapi.json` and `docs/postman/vegetable-marketplace.postman_collection.json`, and validates the specification. In Swagger UI, choose **Authorize** and paste the access token from `POST /api/v1/auth/login`.

## API authentication

1. `POST /api/v1/auth/register` with role `FARMER`, `BUYER`, `TRADER`, `RETAILER`, `RESTAURANT`, or `TRANSPORTER`.
2. `POST /api/v1/auth/verify-phone` with the verification code.
3. `POST /api/v1/auth/login` returns an access token and a rotating refresh token.
4. Send `Authorization: Bearer <accessToken>` on protected routes.
5. `POST /api/v1/auth/refresh-token` rotates the refresh token. Reuse of a revoked token revokes the token family.

Admin, super admin, FPO admin, and market manager accounts are not self-registered. Create them in the database or through an existing admin's role endpoint. Only a super admin can grant `SUPER_ADMIN`.

## Business workflow

```text
Farmer registers and verifies phone
  → admin verifies the farmer profile
  → farmer creates and publishes a listing
  → buyer searches supply and mandi prices
  → buyer makes an offer or buys directly
  → farmer accepts
  → order VEG-YEAR-000001 is created and quantity is reserved
  → payment is recorded
  → transporter is assigned
  → pickup and delivery
  → order completed
  → both parties review
```

Important rules:

- A farmer cannot sell more than the available quantity.
- Accepting an offer reserves quantity inside a transaction.
- Cancelling an order before pickup releases that quantity. Paid orders must be refunded first unless an admin cancels them.
- Live listings, offers, and orders require verified profiles.
- Only the listing owner accepts or rejects a new offer. A buyer can accept after the farmer counters.
- Only completed orders can be reviewed, and a user cannot review the same order twice.
- Expired listings and offers cannot be accepted.
- Financial retries should send `Idempotency-Key` or `idempotencyKey`.

## Database structure

Primary collections: users, farmer profiles, buyer profiles, FPOs, markets, crops, vegetable listings, purchase requirements, offers, orders, payments, webhook events, transporters, deliveries, market prices, notifications, conversations, messages, reviews, disputes, document metadata, and audit logs.

Bank account numbers are encrypted. Document files are stored on local disk or S3. MongoDB stores only the file key, URL, name, mime type, uploader, and document type.

## Project structure

See `src/` above. Tests live in `tests/`. Docker files are `Dockerfile` and `docker-compose.yml`.

## Seed data

```bash
npm run seed
```

The script upserts 15 vegetables (marked `isSeeded`), demo markets in Kolkata, Barasat, Bongaon, Gaighata, Basirhat, and Bagda (marked `isDemo`), sample tomato prices, and these demo accounts:

| Phone | Role | Password |
| --- | --- | --- |
| 9810000001 | Farmer | `Demo@12345` |
| 9810000002 | Buyer | `Demo@12345` |
| 9810000003 | Admin | `Demo@12345` |
| 9810000004 | Transporter | `Demo@12345` |

Change that password before any shared deployment. Demo records are labeled in the database.

Roles are the application enum (`SUPER_ADMIN`, `ADMIN`, `FARMER`, `FPO_ADMIN`, `BUYER`, `TRADER`, `RETAILER`, `RESTAURANT`, `TRANSPORTER`, `MARKET_MANAGER`), not a separate collection.

## Docker setup

```bash
docker compose up --build
```

Compose starts the API, MongoDB 7 as replica set `rs0`, and Redis 7. The API container reads the same environment variables as local development.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | TypeScript watch server |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled server |
| `npm test` | Jest with coverage |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run seed` | Demo crops, markets, prices, and users |
| `npm run swagger` | Validate and export OpenAPI plus Postman |

## Deployment

Build with `npm run build` and run `npm start`. Set `NODE_ENV=production`, long random JWT secrets, a replica-set `MONGODB_URI`, and `REDIS_URL`. Put the process behind TLS. In production, verification codes are not returned in API responses, stack traces are hidden, and the Razorpay webhook requires `RAZORPAY_KEY_SECRET`.

## Production considerations

- Use a replica set so order and payment transactions can commit.
- Rotate refresh tokens and keep access tokens short-lived.
- Store private documents in S3 by setting the AWS variables. Until then, files stay under `uploads/`, which should not be public except `uploads/public`.
- Plug SMS, WhatsApp, and push into the notification channel interface. In-app notifications are stored now.
- Real Razorpay is used only when both Razorpay keys are set. Otherwise `method: RAZORPAY` uses the mock provider and webhook secret `dev-webhook-secret`.
- Background jobs expire listings, offers, and requirements, clean old OTPs, write daily statistics in Asia/Kolkata, and derive market prices from real orders. They do not invent prices.
- Audit logs record login, listings, offers, orders, payments, verification, and blocks.
