# CRM Docker and Technical Documentation

## Scope

This document covers local development and single-host production deployment for:

- Laravel CRM API
- Laravel Horizon worker
- NestJS payment API
- React dashboard
- PostgreSQL
- Redis
- NGINX gateway
- CRM authentication grants and payment permission seeding

The repository root is `/home/swerky/dev/crm`.

## Service architecture

The repository is a small service-oriented system with one public gateway and
separate ownership for CRM and payment data:

```text
                              REAL ESTATE CRM
┌─────────────────────────────────────────────────────────────────────────────┐
│ PUBLIC EDGE                                                                  │
│ Browser / API clients → TLS edge (production) → Host NGINX                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ 127.0.0.1:8080
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ DOCKER NGINX GATEWAY  ·  proxy_net · same-origin routing · load balancing    │
│ / → dashboard (React/Vite; two replicas in production)                       │
└──────────────────────┬───────────────────────────────────┬──────────────────┘
                       │ /api/*                            │ /api/v1/payments
                       │                                   │ /api/v1/invoices
          ┌────────────▼─────────────┐          ┌──────────▼──────────────┐
          │ CRM SERVICE PLANE        │          │ PAYMENTS SERVICE PLANE  │
          │ crm-api-1 · crm-api-2    │          │ payment-api-1 · -2      │
          │ Horizon · scheduler      │          │ NestJS + invoice worker  │
          │ payment event consumer   │          │ auth guards              │
          └────────────┬─────────────┘          └──────────┬──────────────┘
                       │                                    │ auth_reader
          ┌────────────▼─────────────┐          ┌──────────▼──────────────┐
          │ CRM DATA PLANE           │          │ PAYMENTS DATA PLANE     │
          │ PostgreSQL: crm          │◄─────────┤ PostgreSQL: payments     │
          │ Redis ACL: crm:          │ read-only│ Redis ACL: payments:     │
          └────────────┬─────────────┘          └──────────┬──────────────┘
                       │                                    │
                       └──────────────┬─────────────────────┘
                                      │ data_net
                         ┌────────────▼─────────────┐
                         │ EVENT / INTEGRATION PLANE │
                         │ RabbitMQ                  │
                         │ payments.commands         │
                         │ payments.events           │
                         │ retry + dead-letter paths │
                         └──────────────────────────┘
```

| Component | Owns | Connects to |
| --- | --- | --- |
| `server/` | CRM API, users, roles, CRM permissions, reports, and payment command outbox | `crm` database, CRM Redis, RabbitMQ |
| `payment-server/` | Payment API boundary, invoice data, command receipts, and payment permissions | `payments` database, payment Redis, CRM auth tables, RabbitMQ |
| `dashboard/` | Browser UI and generated API client types | Gateway only |
| Docker NGINX | Same-origin routing and upstream balancing | Dashboard, Laravel, and payment service |
| PostgreSQL | Separate `crm` and `payments` databases | Laravel and NestJS through dedicated roles |
| Redis | Isolated `crm:` and `payments:` namespaces and ACL users | Laravel/Horizon and payment service |
| RabbitMQ | Cross-service commands and result events | Laravel publisher/consumer and NestJS consumer/publisher |

The gateway sends `/api/v1/payments` and `/api/v1/invoices` to NestJS. Other
`/api/*` routes go to Laravel. The payment API keeps the `api/v1` prefix; the
gateway does not rewrite it. Dashboard traffic and API traffic are therefore
same-origin in both development and production.

### Payment message flow

Payment integration is asynchronous and uses an outbox/result-event boundary:

1. Laravel records a `payment_commands` row and publishes an
   `invoice.generate` command to the `payments` queue.
2. NestJS consumes the command, applies an idempotent message receipt, writes
   invoice state in the `payments` database, and publishes either
   `invoice.completed` or `invoice.failed`.
3. Laravel's `payments:consume-events` worker consumes `crm.payment-events`
   and updates the originating command status and result.

The command path uses `payments`, `payments.retry`, and `payments.dead`. The
event path uses `crm.payment-events` and `crm.payment-events.dead`. RabbitMQ
durable exchanges, queues, confirms, retry TTL, and dead-letter queues are
declared by both service clients. Laravel Horizon/Redis is separate from this
RabbitMQ workflow; the NestJS payment service does not consume Laravel
serialized Horizon jobs.

### Authentication and data boundaries

CRM remains the source of truth for users, roles, and CRM permissions. The
payment service authenticates the existing Laravel Sanctum bearer token through
its read-only `auth_reader` connection and looks up permission names across the
supported `web` and `sanctum` guard rows. The `auth-grants` job creates or
updates that runtime account, while `payment-auth-seed` adds payment permission
rows to the existing `manager` and `agent` roles through the separate
`auth_seeder` account. Neither payment replica owns or replaces CRM identity
data.

## Requirements

- Docker Engine
- Docker Compose v2
- Git
- OpenSSL
- `curl` for health checks

Production additionally requires host NGINX, a TLS certificate, and an external TLS edge configured to preserve the intended secure origin connection.

## Compose files

| File | Purpose |
| --- | --- |
| `docker-compose.dev.yml` | Local development with source mounts and loopback ports |
| `docker-compose.yml` | Production-style single-host deployment with secrets, read-only containers, and two application replicas |
| `.env.docker` | Local, untracked Compose configuration |
| `.env.docker.example` | Configuration template |
| `.secrets/` | Local, untracked secret files |

The canonical development command is:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml
```

Use this exact command prefix for all development Compose operations.

## Configuration and secrets

Create the local configuration:

```sh
cp .env.docker.example .env.docker
mkdir -p .secrets
```

Create the secret files required by the production Compose file:

```sh
openssl rand -base64 32 | tr -d '\n' > .secrets/laravel_app_key
openssl rand -hex 32 > .secrets/postgres_password
openssl rand -hex 32 > .secrets/crm_db_password
openssl rand -hex 32 > .secrets/payments_db_password
openssl rand -hex 32 > .secrets/auth_db_password
openssl rand -hex 32 > .secrets/auth_seed_db_password
openssl rand -hex 32 > .secrets/crm_redis_password
openssl rand -hex 32 > .secrets/payments_redis_password
chmod 600 .secrets/* .env.docker
```

Update `.env.docker` when changing hostnames, database names, database users, or secret file locations. Do not commit `.env.docker` or `.secrets/`.

The development Compose file uses development defaults for passwords and does not mount production secret files. The production Compose file requires every file listed under `secrets:` in `docker-compose.yml`.

## Development setup

### First start

Validate the rendered Compose configuration:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml config
```

Build and start the development stack:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml up -d --build --wait
```

Run the build only when source or dependency changes require new images. Routine starts do not require `--build`:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml up -d --wait
```

Check service status:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml ps
```

### Services and ports

All published ports bind to `127.0.0.1`.

| Service | Host address | Container port |
| --- | --- | --- |
| Gateway | `http://127.0.0.1:8080` | `8080` |
| Payment API | `http://127.0.0.1:13000` | `3000` |
| Dashboard dev server | `http://127.0.0.1:15173` | `5173` |
| Laravel PHP-FPM | `127.0.0.1:19000` | `9000` |
| PostgreSQL | `127.0.0.1:15432` | `5432` |
| Redis | `127.0.0.1:16379` | `6379` |
| RabbitMQ management UI | `http://127.0.0.1:15672` | `15672` |

The gateway is the normal entry point for the dashboard and API. The payment API port is useful for direct health checks.

The development PostgreSQL, Redis, and RabbitMQ host bindings are for local
inspection only. Application traffic uses the internal `data_net`; the
development-only `dev_access_net` makes the loopback bindings usable from the
host. Production publishes only the gateway on `127.0.0.1:8080`.

### Database migration and seed order

CRM tables and CRM roles must exist before the payment auth setup runs.

For a destructive development reset:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml exec crm-api php artisan migrate:fresh --seed
```

For an existing development database:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml exec crm-api php artisan migrate --seed
```

Apply auth database grants after CRM migrations complete:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml --profile auth run --rm auth-grants
```

Seed payment permissions after the grants complete:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml --profile auth --profile seed run --rm payment-auth-seed
```

The complete order is:

```text
CRM migration and CRM seeders
        ↓
Auth table grants
        ↓
Payment permission seeder
```

The CRM `RoleSeeder` creates the `manager` and `agent` roles. The payment seeder adds payment permissions to those existing roles without replacing CRM permissions. Permission and role lookup is name-based across `web` and `sanctum` guard rows.

### Verification

Check container health:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml ps
```

Check the payment API:

```sh
curl -fsS http://127.0.0.1:13000/api/v1/health/live
curl -fsS http://127.0.0.1:13000/api/v1/health/ready
```

The readiness response must report successful `database`, `auth`, and `redis` checks.

Check logs:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml logs --tail=200 payment-api crm-api postgres redis gateway
```

Check seeded auth data:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml exec -T postgres \
  psql -U postgres -d crm \
  -c "SELECT name FROM roles ORDER BY name;" \
  -c "SELECT COUNT(*) AS permissions FROM permissions;"
```

### Development commands

Open a Laravel shell:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml exec crm-api sh
```

Run an Artisan command:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml exec crm-api php artisan <command>
```

Follow service logs:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml logs -f <service>
```

Stop containers without deleting data:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml down
```

Reset all development volumes:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml down -v --remove-orphans
```

The reset removes the development PostgreSQL database, Redis data, Laravel storage, and dependency volumes. It is irreversible for local data stored only in those volumes.

## Development shortcuts

Source the shortcut file for shell helpers:

```sh
source docker/shortcuts.zsh.sh
```

Available Zsh helpers:

| Helper | Operation |
| --- | --- |
| `up` | Start development containers |
| `down` | Stop development containers |
| `ps` | Show service status |
| `art` | Run Artisan through `crm-api` |
| `dx` | Execute a command in a container |
| `logs` | Follow Compose logs |
| `fresh` | Destructively reset, migrate, seed, grant auth access, and seed payment permissions |

`fresh` deletes development volumes. Use it only when a complete local reset is intended.

Bash users can source `docker/shortcuts.bash.sh`. The direct Compose commands in this document remain the source of truth for the complete auth setup.

## Production setup

Production uses `docker-compose.yml` and Docker secret files. It does not use the development Compose file or development defaults.

Validate the production configuration:

```sh
docker compose --env-file .env.docker -f docker-compose.yml config
```

Build the production images:

```sh
docker compose --env-file .env.docker -f docker-compose.yml build
```

Start PostgreSQL and Redis:

```sh
docker compose --env-file .env.docker -f docker-compose.yml up -d postgres redis
```

Run the migration job:

```sh
docker compose --env-file .env.docker -f docker-compose.yml run --rm crm-migrate
```

`crm-migrate` runs `migrate --force --seed`, so CRM migrations and seeders complete before auth grants.

Apply auth grants:

```sh
docker compose --env-file .env.docker -f docker-compose.yml run --rm auth-grants
```

Seed payment permissions:

```sh
docker compose --env-file .env.docker -f docker-compose.yml --profile seed run --rm payment-auth-seed
```

Start the application, workers, dashboard, and gateway:

```sh
docker compose --env-file .env.docker -f docker-compose.yml up -d
```

Verify the deployment:

```sh
docker compose --env-file .env.docker -f docker-compose.yml ps
curl -fsS http://127.0.0.1:8080/healthz
```

Do not run `migrate:fresh --seed` in production. Keep previous application images available until health, route, and smoke checks pass.

## Production networking

The intended production path is:

```text
External TLS edge
        ↓ TLS
Host NGINX
        ↓ 127.0.0.1:8080
Docker NGINX gateway
        ↓
CRM API, payment API, dashboard
```

PostgreSQL, Redis, PHP-FPM, and payment API application ports remain private to Docker networks. Configure host NGINX using the example configuration in `docker/nginx/` and validate it with:

```sh
nginx -t
docker compose --env-file .env.docker -f docker-compose.yml exec gateway nginx -t
```

This is a single-host deployment. Two Laravel and two payment replicas reduce
the impact of an individual application container failure, but PostgreSQL,
Redis, RabbitMQ, the Docker daemon, the gateway, and the host remain single-host
failure domains. The design is not multi-host high availability.

## Replica replacement and recovery

Inspect the production stack and recent gateway/application logs with:

```sh
docker compose --env-file .env.docker -f docker-compose.yml ps
docker compose --env-file .env.docker -f docker-compose.yml logs --tail=200 gateway crm-api-1 payment-api-1
docker compose --env-file .env.docker -f docker-compose.yml exec gateway nginx -T
```

Replace one application replica at a time and verify that the remaining
replica serves traffic before replacing the next one:

```sh
docker compose --env-file .env.docker -f docker-compose.yml stop crm-api-1
docker compose --env-file .env.docker -f docker-compose.yml up -d crm-api-1
```

The upstream definitions use Docker service names and re-resolution so a
recreated container can receive traffic without a gateway restart. Do not
automatically retry non-idempotent payment requests during a replacement.

## Backup and maintenance

- Back up PostgreSQL with a consistent logical or physical backup procedure.
- Back up the `laravel_media` volume with PostgreSQL because media rows and
  files are related state.
- Treat Redis as operational state: queues and locks may matter for recovery,
  but Redis is not a substitute for database backups.
- Rehearse a restore in an isolated Compose project before relying on a backup.
- Rotate one credential at a time and restart only the dependent services.
- Rebuild pinned images regularly so base-image and dependency security updates
  are applied.

Example state checks:

```sh
docker compose --env-file .env.docker -f docker-compose.yml exec postgres pg_isready -U postgres -d postgres
docker compose --env-file .env.docker -f docker-compose.yml exec redis redis-cli --user crm --pass "$(cat .secrets/crm_redis_password)" ping
```

Before a production release, run the route matrix, replica-loss,
container-recreation, persistence, backup/restore, and resource checks in
[`docs/docker-implementation-plan.md`](docker-implementation-plan.md). Compose
validation and image builds alone do not prove browser or production-origin
behavior.

## Troubleshooting

### Missing secret bind source

Error:

```text
bind source path does not exist: .../.secrets/auth_seed_db_password
```

The production Compose file cannot mount a secret file that does not exist. Create all files from [Configuration and secrets](#configuration-and-secrets), or use `docker-compose.dev.yml` for local development.

### Permission denied on an auth table

Run the auth grant job after CRM migrations and before the payment permission seeder:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml --profile auth run --rm auth-grants
docker compose --env-file .env.docker -f docker-compose.dev.yml --profile auth --profile seed run --rm payment-auth-seed
```

The grant job creates or updates `auth_reader` and `auth_seeder` and grants the required table and sequence privileges.

### Roles exist but cannot be read

Verify:

1. CRM migrations and `RoleSeeder` completed.
2. `auth-grants` completed after the tables were created.
3. The payment API uses `auth_reader` for runtime reads.
4. The role names are `manager` and `agent`, unless `PAYMENTS_AUTH_SEED_ROLE_NAMES` was changed.

The payment auth lookup does not reject a role or permission solely because its guard is `web` or `sanctum`.

### Orphan containers

Remove containers from an older Compose project definition:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml down --remove-orphans
docker compose --env-file .env.docker -f docker-compose.dev.yml up -d --wait
```

### Service is unhealthy

Inspect status and recent logs:

```sh
docker compose --env-file .env.docker -f docker-compose.dev.yml ps -a
docker compose --env-file .env.docker -f docker-compose.dev.yml logs --tail=200 <service>
```

Check the payment API independently:

```sh
curl -fsS http://127.0.0.1:13000/api/v1/health/live
curl -fsS http://127.0.0.1:13000/api/v1/health/ready
```

## Data and security rules

- Do not commit `.env.docker` or `.secrets/`.
- Do not put secrets in Dockerfiles, image arguments, Compose commands, health checks, or `VITE_*` variables.
- Do not use `migrate:fresh --seed` in production.
- Do not delete named volumes unless local data loss is intended.
- Keep PostgreSQL, Redis, PHP-FPM, and internal application ports private in production.
- Back up PostgreSQL and the `laravel_media` volume together.
- Test database restore procedures in an isolated Compose project.
