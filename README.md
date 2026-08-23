<div align="center">
  <h1>Real Estate CRM</h1>
  <p>Permission-aware operations for real-estate teams.</p>
</div>

<br />

<p align="center">
  <a href="./github/assets/overview.gif"><img src="./github/assets/overview.gif" alt="CRM dashboard overview" width="640" /></a>
</p>

<br />

<p align="center">
  <a href="https://laravel.com"><img src="https://img.shields.io/badge/Laravel-13-FF2D20?logo=laravel&logoColor=white" alt="Laravel 13" /></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://vite.dev"><img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite 8" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5" /></a>
  <a href="https://www.postgresql.org"><img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="https://redis.io"><img src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white" alt="Redis" /></a>
  <a href="https://api-crm.swerky.dev/api-docs"><img src="https://img.shields.io/badge/OpenAPI-API%20Docs-6BA539?logo=openapiinitiative&logoColor=white" alt="OpenAPI API Documentation" /></a>
</p>

<p align="center">
  Real-estate CRM for leads, properties, deals, commissions, and reporting.
</p>

<br />

## API Documentation

Explore the production API reference:

<p><a href="https://api-crm.swerky.dev/api-docs">https://api-crm.swerky.dev/api-docs</a></p>

## Architecture

```text
                              REAL ESTATE CRM
┌─────────────────────────────────────────────────────────────────────────────┐
│ PUBLIC EDGE                                                                 │
│ Browser / API clients → TLS edge (production) → Host NGINX                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ 127.0.0.1:8080
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ DOCKER NGINX GATEWAY  ·  same-origin routing · upstream balancing           │
│ / → dashboard (React/Vite; two replicas in production)                      │
└──────────────────────┬───────────────────────────────────┬──────────────────┘
                       │ /api/*                            │ /api/v1/payments
                       │                                   │ /api/v1/invoices
          ┌────────────▼─────────────┐          ┌──────────▼──────────────┐
          │ CRM SERVICE PLANE        │          │ PAYMENTS SERVICE PLANE  │
          │ Laravel API ×2           │          │ NestJS payment API ×2   │
          │ Horizon · scheduler      │          │ invoices · auth guards  │
          │ payment event consumer   │          │ payment-server/         │
          └────────────┬─────────────┘          └──────────┬──────────────┘
                       │                                    │ auth_reader
          ┌────────────▼─────────────┐          ┌──────────▼──────────────┐
          │ CRM DATA PLANE           │          │ PAYMENTS DATA PLANE     │
          │ PostgreSQL: crm          │◄─────────┤ PostgreSQL: payments    │
          │ Redis: crm:              │ read-only│ Redis: payments:        │
          └────────────┬─────────────┘          └──────────┬──────────────┘
                       │                                    │
                       └──────────────┬─────────────────────┘
                                      │
                         ┌────────────▼──────────────┐
                         │ EVENT / INTEGRATION PLANE │
                         │ RabbitMQ                  │
                         │ command → result event    │
                         │ payments → crm.payment-   │
                         │ events                    │
                         └───────────────────────────┘

docs/openapi/  canonical API contracts → generated dashboard TypeScript
```

The Laravel API owns CRM users, roles, and permissions. The payment service owns
payment data and reads the CRM auth tables through the restricted `auth_reader`
connection; one-shot grant and seed jobs establish that boundary. RabbitMQ is
the integration boundary between the services, while Laravel Horizon and Redis
remain responsible for CRM jobs and queues.

## Installation

Development uses Docker Compose. Copy the local configuration, validate the
stack, start it, then apply the CRM and payment authorization setup in order:

```sh
cp .env.docker.example .env.docker
docker compose --env-file .env.docker -f docker-compose.dev.yml config
docker compose --env-file .env.docker -f docker-compose.dev.yml up -d --wait
docker compose --env-file .env.docker -f docker-compose.dev.yml exec crm-api php artisan migrate --seed
docker compose --env-file .env.docker -f docker-compose.dev.yml --profile auth run --rm auth-grants
docker compose --env-file .env.docker -f docker-compose.dev.yml --profile auth --profile seed run --rm payment-auth-seed
```

The full technical guide covers prerequisites, environment and secrets,
development and production Compose, service boundaries, migrations, health
checks, backups, deployment, and troubleshooting: [Docker and technical documentation](docs/docker-operations.md).

## Hard problems

| Problem | How it is handled |
| --- | --- |
| Contract drift | API schemas are written in `docs/openapi/`; dashboard types are generated from them. |
| Complex access | Policies apply to records, relations, media, activity history, and UI actions. |
| Commission accuracy | Deal changes recalculate allocations in the same database transaction. |
| Historical reporting | Pipeline reports use when a deal entered a status, not its current status. |

## Jobs and queues

| Trigger | Work |
| --- | --- |
| After lead conversion commits | Queue lead conversion work. |
| Every 5 minutes | Queue due daily and monthly sales-pipeline reports. |
| Hourly | Recalculate commissions with overlap protection. |
| Daily | Prune expired reports and Telescope records. |

Analytics report generation runs as a queued job. Horizon processes background work; Redis provides the queue, cache, sessions, and locks.

## Releases

The CRM uses one repository-wide Semantic Version and Release Please. Merges to `main` create or update a release pull request; merging that pull request updates `VERSION` and `CHANGELOG.md`, creates a `vX.Y.Z` tag, and publishes the GitHub release.

Use Conventional Commit prefixes so release changes can be classified automatically:

- `feat:` creates a minor release.
- `fix:` creates a patch release.
- `feat!:` or `BREAKING CHANGE:` creates a major release.
- `chore:`, `docs:`, and `test:` are normally non-release changes.

The initial product version is `0.1.0`. Deployment and Docker image publishing remain separate from the release workflow. Published release titles and notes may be corrected without changing the version or tag; code changes require a new version.

## Quality gates

Checks are scoped to the files that changed.

- Commits regenerate and validate `dashboard/public/openapi.json` from `docs/openapi/`.
- Laravel runs Composer validation, Pint, Larastan, PHP Insights, and tests.
- The dashboard runs API-contract checks, ESLint, TypeScript, and tests.
- Payments runs ESLint and tests.
- Docker changes run Compose structure validation; pushes also run affected builds and API checks.
