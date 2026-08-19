# Docker Deployment Implementation Plan

Status: approved implementation blueprint; no Docker runtime files have been created yet.

Research and repository review date: 2026-08-17.

## 1. Objective

Build two complete, secure Docker environments for the CRM repository:

- Development: fast feedback, bind-mounted source, hot reload, and safe local defaults.
- Production: immutable multi-stage images, least-privilege containers, bounded resource usage, health checks, multiple application instances, and a single protected ingress.

The stack contains:

- `server/`: Laravel API, PHP-FPM, Horizon, and the scheduler.
- `payment-server/`: NestJS payment API.
- `dashboard/`: React 19 dashboard built with Vite.
- PostgreSQL: the database server, with isolated databases and users for Laravel and NestJS.
- Redis: one shared Redis server with isolated ACL users and key namespaces.
- NGINX: the only Docker service reachable from the host.

This plan targets the current single VPS: 1 vCPU, 4 GB RAM, with an approximate 2 GB memory budget for the Docker stack.

## 2. Decisions already agreed

### 2.1 Public request routing

The Docker gateway must preserve the original request URI and apply this precedence:

| Request path | Destination |
| --- | --- |
| `/api/v1/payments` and descendants | NestJS payment API |
| `/api/v1/invoice` and descendants | NestJS payment API |
| Every other `/api/*` request | Laravel CRM API |
| `/storage/*` | Laravel public media storage |
| All remaining paths | React dashboard, with SPA fallback |

Important boundary rules:

- The invoice route is deliberately singular: `/api/v1/invoice`.
- `/api/v1/payments-old`, `/api/v1/invoices`, and similar partial matches must not enter the NestJS locations accidentally.
- Existing Laravel authentication routes remain available at `/api/login`, `/api/logout`, and `/api/user`.
- The NestJS application will use the global prefix `api/v1`; NGINX will not strip the prefix.
- Dashboard production builds use `VITE_API_BASE_URL=/api` so browser API traffic is same-origin.

### 2.2 Ingress and TLS

Production request flow:

```text
Browser HTTPS
  -> Cloudflare
  -> existing VPS NGINX on 443, Cloudflare Full (Strict)
  -> http://127.0.0.1:8080
  -> Docker NGINX gateway
  -> internal application pools
```

Only `127.0.0.1:8080` is published by Docker. Laravel, NestJS, dashboard instances, PostgreSQL, and Redis publish no host ports.

The existing VPS NGINX terminates TLS using a Cloudflare Origin CA certificate. Docker's internal HTTP traffic is accepted as a single-host trust-boundary tradeoff; it is never exposed to the public network.

### 2.3 Availability scope

The design provides a multi-process application pool on one host. It protects against an individual application container failing, but it is not host-level high availability. The VPS, Docker daemon, Docker NGINX gateway, PostgreSQL, and Redis remain single-host failure domains.

True high availability would require at least another host and external or replicated stateful services.

## 3. Required deliverables

### 3.1 Requested development files

```text
docker-compose.dev.yml
docker/crm-server/Dockerfile.dev
docker/payment-server/Dockerfile.dev
docker/dashboard/Dockerfile.dev
docker/nginx/nginx.dev.conf
docker/nginx/upstreams.dev.conf
```

### 3.2 Requested production files

```text
docker-compose.yml
docker/crm-server/Dockerfile
docker/payment-server/Dockerfile
docker/dashboard/Dockerfile
docker/nginx/nginx.conf
docker/nginx/upstreams.conf
```

### 3.3 Supporting files required for a secure, maintainable result

```text
docker/crm-server/php.dev.ini
docker/crm-server/php.ini
docker/crm-server/opcache.ini
docker/crm-server/www.conf
docker/crm-server/entrypoint.sh
docker/payment-server/entrypoint.sh
docker/dashboard/nginx.conf
docker/redis/redis.conf
docker/redis/users.acl.example
docker/postgres/init/01-create-application-databases.sh
docker/postgres/postgresql.conf
docker/nginx/vps-site.example.conf
server/.dockerignore
payment-server/.dockerignore
dashboard/.dockerignore
.env.docker.example
docs/docker-operations.md
```

Actual secret files must live outside version control. The repository will contain only templates and documentation.

## 4. Target architecture

```text
                                      +----------------------+
                                      | postgres             |
                                      | crm + payments DBs   |
                                      +----------+-----------+
                                                 ^
                                                 | data_net
                                                 v
+------------------+     proxy_net     +----------+-----------+
| Docker NGINX     +------------------>| crm-api-1 / crm-api-2|
| 127.0.0.1:8080   |                   +----------------------+
|                  |                   | payment-1 / payment-2|
| route + balance  |                   +----------------------+
|                  |                   | dashboard-1 / -2     |
+--------+---------+                   +----------+-----------+
         |                                        |
         |                              data_net  v
         |                              +---------+----------+
         |                              | redis              |
         |                              | per-service ACLs   |
         |                              +--------------------+
         |
         +-- only published Docker port

Separate supporting processes:
- crm-horizon: data_net + egress_net
- crm-scheduler: data_net + egress_net
- crm-migrate: one-shot deployment job
```

## 5. Compose design

### 5.1 Shared principles

Both Compose files will:

- Use explicit service names, networks, volumes, health checks, and restart policies.
- Avoid `network_mode: host`, privileged mode, Docker socket mounts, and broad Linux capabilities.
- Publish only the gateway port.
- Use service health conditions where startup ordering matters.
- Store PostgreSQL and Redis state in named volumes.
- Use `init: true` where PID 1 signal and zombie handling are relevant.
- Apply log rotation with bounded `json-file` settings or the VPS logging standard.
- Define container memory and CPU limits compatible with local Compose execution.
- Keep database migrations out of ordinary application startup to avoid races between replicas.
- Add a one-shot, manually invoked migration service.

### 5.2 Network segmentation

Define three user-created bridge networks:

| Network | Members | Purpose |
| --- | --- | --- |
| `proxy_net` | Docker NGINX, Laravel API, NestJS API, dashboard | Only traffic entering from the gateway |
| `data_net` | Laravel processes, NestJS, PostgreSQL, Redis | Private stateful-service access; set `internal: true` |
| `egress_net` | Laravel and NestJS processes that need outbound access | Explicit outbound dependency access |

PostgreSQL and Redis must not join `proxy_net` or publish ports. The dashboard must not join `data_net` or `egress_net`.

Because an `internal` Docker network has no external route, application containers needing internet access also join `egress_net`. Network attachment alone is not a complete egress firewall; host firewall rules or a controlled proxy are required if destination allowlisting becomes necessary.

### 5.3 Development Compose

`docker-compose.dev.yml` will prioritize feedback speed while preserving isolation:

- Build development Dockerfiles.
- Bind-mount application source into each development container.
- Keep dependency directories in named volumes so host mounts do not hide container-installed dependencies:
  - Laravel `vendor/`
  - NestJS `node_modules/`
  - dashboard `node_modules/`
- Run Vite and NestJS watch modes inside their containers.
- Run PHP-FPM for Laravel; do not use `php artisan serve` behind NGINX.
- Default to one instance per application to reduce laptop resource usage.
- Keep the pool include file compatible with explicitly scaled services.
- Publish Docker NGINX to `127.0.0.1:8080:8080` by default.
- Expose no database, Redis, Vite, NestJS, or PHP-FPM port directly to the host.
- Include an opt-in destructive reset profile or documented command; never run `migrate:fresh --seed` automatically.
- Make Xdebug optional through a Compose profile or build target rather than enabling it for every request.

If direct browser HMR cannot operate through the gateway, proxy Vite's websocket through Docker NGINX. Do not publish the Vite port merely as a shortcut.

### 5.4 Production Compose

`docker-compose.yml` will:

- Build immutable production images.
- Run two Laravel API containers.
- Run two NestJS API containers.
- Run two lightweight dashboard static-server containers.
- Run one Horizon container and one scheduler container from the Laravel image.
- Run one PostgreSQL and one Redis container with persistent storage.
- Run one Docker NGINX gateway.
- Provide a one-shot `crm-migrate` service invoked during deployment before application replacement.
- Use `restart: unless-stopped` for long-running services and `restart: no` for migration jobs.
- Use `read_only: true` where possible and explicit `tmpfs` or writable volumes where required.
- Drop all Linux capabilities and add back only those demonstrably required.
- Apply `security_opt: [no-new-privileges:true]`.
- Set `stop_grace_period` values that let PHP-FPM, Node, Horizon, and NGINX finish or safely stop work.

Compose replicas on a single host are addressed through Docker DNS. The pool include files will define logical upstream pools and must support DNS re-resolution so recreated containers do not leave stale NGINX addresses.

## 6. Image construction

### 6.1 General production image rules

- Use multi-stage builds.
- Pin each base image to an exact digest during implementation; record the human-readable tag beside it.
- Rebuild regularly for patched OS and runtime layers.
- Copy lockfiles before source code for stable dependency caching.
- Install using lockfile-enforcing commands.
- Keep compilers, headers, package-manager caches, and test dependencies out of runtime stages.
- Run as a dedicated numeric non-root user.
- Set a minimal, explicit `PATH`, locale, and production environment.
- Never copy `.env`, Git metadata, tests, local storage, logs, coverage, or editor files into production images.
- Add Dockerfile-specific ignore files so each service receives only its own context.
- Include OCI labels for source revision and build time without embedding secrets.
- Produce SBOMs and vulnerability scans in CI; fail based on an agreed severity and fix-availability policy.

### 6.2 Laravel development image

`docker/crm-server/Dockerfile.dev` will:

- Use a current supported PHP-FPM Alpine image compatible with Laravel's PHP requirement.
- Install only required build packages and PHP extensions.
- Include Composer from its official image.
- Support developer dependencies.
- Keep OPcache conservative for source changes.
- Optionally install Xdebug only through an explicit build argument or target.
- Run PHP-FPM as the application user, with mounted Laravel runtime paths writable.

Required extensions must be derived from `composer.lock` and Laravel features. Expected candidates include PDO PostgreSQL, Redis, BCMath, Intl, ZIP, GD or Imagick, Exif, PCNTL, and process-control support needed by Horizon. The exact list must be verified against Composer platform requirements instead of installed speculatively.

### 6.3 Laravel production image

`docker/crm-server/Dockerfile` will use builder and runtime stages:

1. Install PHP/Composer dependencies with authoritative lockfile checks.
2. Use `composer install --no-dev --prefer-dist --no-interaction --no-progress --classmap-authoritative`.
3. Copy only the production application and vendor tree.
4. Set ownership during `COPY` rather than recursively changing it in an extra layer.
5. Run as the non-root application user.

Runtime filesystem policy:

- Source, `.env`, `vendor/`, and configuration are read-only.
- Only these Laravel runtime locations are writable:
  - `storage/framework/cache`
  - `storage/framework/cache/data`
  - `storage/framework/views`
  - `storage/framework/sessions` if the selected session driver uses files
  - `storage/logs` only if logs are not sent to stderr
  - `storage/media-library/temp`
  - public or private media volume paths actually used by the application
  - `bootstrap/cache`
- Prefer stdout/stderr logging.
- Use a persistent media volume because the current application uses local media storage. Multiple Laravel replicas must mount the same media volume.

PHP-FPM and OPcache starting values for this VPS:

- `pm = ondemand`
- `pm.max_children = 1` per Laravel API replica initially
- short idle timeout to reclaim idle workers
- OPcache enabled with timestamp validation disabled in production
- OPcache memory near 64 MB initially, then measured
- JIT disabled unless workload profiling proves a benefit
- realpath cache enabled and sized modestly
- request termination timeout and slow-request logging enabled
- `expose_php = Off`
- disallow dangerous configuration overrides in the web pool

Run `php artisan config:cache`, `route:cache`, and `view:cache` during the deployment lifecycle after runtime environment variables are present. Do not bake environment-specific cached configuration into a reusable image.

### 6.4 NestJS development image

`docker/payment-server/Dockerfile.dev` will:

- Use a current Node LTS Alpine image.
- Install dependencies using `npm ci`.
- Run the existing Nest development/watch command.
- Keep `node_modules` in a container volume.
- Run as the built-in or dedicated non-root Node user.
- Forward termination signals correctly.

### 6.5 NestJS production image

`docker/payment-server/Dockerfile` will use stages for dependencies, build, and runtime:

- Validate and install from the lockfile with `npm ci`.
- Compile TypeScript in the builder stage.
- Prune or separately install production dependencies only.
- Copy only compiled output, production dependencies, package metadata, and required runtime assets.
- Set `NODE_ENV=production`.
- Run as non-root.
- Set a conservative V8 old-space limit near 128 MB, then tune from measurements.
- Use an exec-form command so signals reach Node.

NestJS application work required by the deployment:

- Set `app.setGlobalPrefix('api/v1')`.
- Add `/api/v1/health/live` and `/api/v1/health/ready` using Terminus or equivalent.
- Readiness must verify PostgreSQL and Redis connectivity if those dependencies are required to serve requests.
- Configure TypeORM for the payments database and dedicated database user.
- Configure Redis using the payment ACL credentials and namespace.
- Enable Helmet before routes.
- Configure a narrow CORS policy or disable application CORS when all browser access is same-origin through NGINX.
- Configure global validation with whitelist and transform behavior appropriate to existing DTOs.
- Limit JSON and URL-encoded body sizes.
- Use compression only once in the request path; prefer NGINX for HTTP compression.
- Add graceful shutdown hooks.
- Trust proxy headers only for the known proxy topology.

This deployment work does not invent payment business endpoints. It only provides infrastructure, routing, health, and dependency configuration for existing or separately implemented controllers.

### 6.6 Dashboard development image

`docker/dashboard/Dockerfile.dev` will:

- Use the same supported Node LTS family as the NestJS build where practical.
- Install with `npm ci`.
- Run Vite on the container interface.
- Keep `node_modules` in a container volume.
- Set Vite's host and allowed-host behavior explicitly.
- Proxy websocket upgrade traffic through NGINX for HMR.
- Use `/api` as the browser-facing API base unless a documented local override is required.

### 6.7 Dashboard production image

`docker/dashboard/Dockerfile` will:

- Build with Vite in a Node builder stage.
- Set `VITE_API_BASE_URL=/api` at build time.
- Disable production source maps unless an authenticated error-monitoring upload workflow is added.
- Copy only `dist/` into an unprivileged NGINX runtime image.
- Serve immutable hashed assets with a long cache lifetime.
- Serve `index.html` with no-cache or short revalidation so deployments become visible promptly.
- Implement `try_files $uri $uri/ /index.html` in the dashboard's internal NGINX configuration.
- Run without root privileges and without a writable document root.

## 7. Docker NGINX gateway

### 7.1 Configuration separation

- `nginx.dev.conf`: development routes, HMR websocket handling, developer-friendly timeouts, and no production caching assumptions.
- `upstreams.dev.conf`: development upstream pool definitions.
- `nginx.conf`: production routing, headers, timeouts, buffering, static/media handling, and error policy.
- `upstreams.conf`: production upstream pools for Laravel, NestJS, and dashboard replicas.

The pool files are separate because topology and instance counts should be adjustable without mixing them into request-routing policy.

### 7.2 Upstream behavior

Production pools will use:

- `least_conn` for application pools.
- Keepalive connections where the upstream protocol supports them.
- Shared upstream zones.
- Docker's embedded DNS resolver at `127.0.0.11` with a short valid period.
- Dynamic name resolution compatible with container recreation.
- Conservative passive failure detection using `max_fails` and `fail_timeout`.

Open-source NGINX does not provide full active health checks. Compose health checks prevent unhealthy startup ordering, while NGINX passive checks remove instances after request failures. Monitoring must alert on unhealthy containers rather than treating the pool as complete HA.

### 7.3 Exact route matching strategy

Use location precedence that prevents accidental prefix capture. Conceptually:

```nginx
location = /api/v1/payments { proxy_pass http://payment_pool; }
location ^~ /api/v1/payments/ { proxy_pass http://payment_pool; }

location = /api/v1/invoice { proxy_pass http://payment_pool; }
location ^~ /api/v1/invoice/ { proxy_pass http://payment_pool; }

location ^~ /api/ { fastcgi_pass crm_pool; }
location ^~ /storage/ { ... }
location / { proxy_pass http://dashboard_pool; }
```

The final Laravel configuration must pass the correct script filename and path info to PHP-FPM without permitting arbitrary `.php` execution. The gateway should route all Laravel API requests to the single intended front controller.

### 7.4 Proxy safety and performance

- Replace, do not append blindly to, untrusted forwarding headers.
- Pass the original host and request scheme from the trusted VPS proxy.
- Set request IDs and propagate them to applications and logs.
- Reject malformed or unexpected methods where appropriate.
- Set explicit connect, send, and read timeouts.
- Set body limits by route. Laravel media upload support currently permits up to ten 10 MB files, so the relevant media route needs overhead above 100 MB; do not grant that limit to every payment endpoint.
- Buffer ordinary API requests and responses, but disable or tune buffering for streaming routes if any are introduced.
- Do not automatically replay non-idempotent requests to another upstream after a partial failure.
- Enable gzip for suitable text assets at the gateway or dashboard layer, avoiding duplicate compression.
- Hide version tokens.
- Add `X-Content-Type-Options`, `Referrer-Policy`, frame restrictions, and an application-tested Content Security Policy.
- Set HSTS only at the public TLS endpoint after HTTPS is verified end to end.
- Return controlled error pages without leaking upstream addresses or stack details.

## 8. PostgreSQL design

Use one PostgreSQL server with logical isolation:

- Database `crm`, owned or accessed by a dedicated CRM role.
- Database `payments`, owned or accessed by a dedicated payments role.
- Separate randomly generated application passwords.
- An administrative bootstrap password used only for initialization and operations.
- SCRAM-SHA-256 password authentication.
- No host-published port.
- A named persistent volume.
- A health check using `pg_isready` with credentials supplied safely.

The initialization script must be idempotent in intent but documented accurately: scripts under the official image's initialization directory execute only for a new, empty database volume. Password rotation and changes to existing clusters require an explicit operational procedure.

Starting PostgreSQL tuning for the constrained VPS should be modest and measurement-led, for example:

- `max_connections` near 30 rather than the default being treated as free capacity.
- `shared_buffers` near 96 MB.
- low per-operation `work_mem`.
- bounded maintenance memory.
- slow-query logging with a useful threshold.
- connection pooling considered later if measured connection pressure warrants PgBouncer.

Internal database TLS is not enabled in this single-host plan. If database traffic leaves the Docker host in the future, require TLS and revisit certificates, hostname verification, and firewall rules before migration.

## 9. Redis design

Run one Redis server while isolating clients:

- Disable the default Redis user.
- Create separate ACL users for Laravel and NestJS.
- Restrict each user to the commands it actually needs.
- Restrict each user to its key patterns.
- Apply explicit key prefixes/namespaces for CRM cache, queues, sessions, and payment data.
- Bind only inside the private Docker network and publish no port.
- Store ACL credentials in Docker secrets or mounted secret files, not Compose command lines.

Starting persistence and memory policy:

- AOF with `appendfsync everysec`.
- Periodic RDB snapshots as a second recovery path.
- Named persistent volume.
- Container memory near 160 MB.
- Redis `maxmemory` near 96 MB, leaving room for process and fragmentation overhead.
- `maxmemory-policy noeviction` initially so queue data is not silently evicted.

Redis is shared infrastructure, not shared authorization. ACLs and namespaces are mandatory. If payment traffic later needs stronger availability or blast-radius isolation, move it to a separate Redis deployment.

## 10. Secrets and configuration

### 10.1 Required secrets

At minimum:

- Laravel `APP_KEY`.
- PostgreSQL bootstrap/admin password.
- CRM database password.
- Payments database password.
- CRM Redis ACL password.
- Payments Redis ACL password.
- Any payment provider credentials.
- Cloudflare Origin CA private key on the host, outside the repository.

### 10.2 Handling policy

- Commit only `.example` templates with fake values.
- Keep real secret files outside the repository and restrict their permissions.
- Mount secrets read-only under `/run/secrets` when the application supports file-based configuration.
- Where frameworks require environment variables, use a small entrypoint to read the secret file and export only to the child process.
- Do not put secrets in Dockerfile `ARG`, image layers, image labels, Compose commands, health-check commands visible through inspection, or frontend `VITE_*` variables.
- Rotate credentials independently by service.
- Treat every Vite variable as public because it is embedded in browser assets.

## 11. Resource budget

Initial production caps for the approximately 2 GB Docker budget:

| Workload | Count | Limit each | Approximate total |
| --- | ---: | ---: | ---: |
| Laravel API | 2 | 256 MB | 512 MB |
| NestJS API | 2 | 192 MB | 384 MB |
| Dashboard static server | 2 | 32 MB | 64 MB |
| Docker NGINX gateway | 1 | 64 MB | 64 MB |
| Laravel Horizon | 1 | 192 MB | 192 MB |
| Laravel scheduler | 1 | 96 MB | 96 MB |
| PostgreSQL | 1 | 384 MB | 384 MB |
| Redis | 1 | 160 MB | 160 MB |
| **Total limits** |  |  | **1,856 MB** |

This leaves only a small amount within the 2 GB stack allocation. Limits are starting guardrails, not a substitute for measurement. On a 1 vCPU machine, excessive replica concurrency can reduce throughput through context switching; two instances are primarily for process-failure tolerance, not doubled performance.

CPU allocations should prevent any one service from starving the gateway and stateful services. PostgreSQL, Redis, and NGINX need predictable minimum access; application CPU quotas should be tuned after load testing.

## 12. Health and lifecycle

### 12.1 Health endpoints

- Laravel liveness: existing `/up` endpoint.
- Laravel readiness: add or configure a protected operational endpoint that checks required dependencies without exposing secret details.
- NestJS liveness: process/event-loop health only.
- NestJS readiness: database and Redis checks.
- Dashboard: internal HTTP check for `index.html`.
- PostgreSQL: `pg_isready`.
- Redis: authenticated `PING` or a minimal ACL-safe check.
- Docker NGINX: local gateway endpoint that verifies NGINX itself without requiring every upstream to be healthy.

Health endpoints must be cheap, bounded by short timeouts, and excluded from noisy access logs where appropriate.

### 12.2 Deployment sequence

1. Validate configuration and secret presence.
2. Pull or build digest-pinned images.
3. Start or confirm PostgreSQL and Redis health.
4. Run the one-shot Laravel migration job once.
5. Replace application replicas gradually.
6. Confirm readiness through Docker NGINX.
7. Replace dashboard instances.
8. Reload or replace Docker NGINX only after `nginx -t` succeeds.
9. Run route, health, and dependency smoke tests.
10. Keep the previous image tags available for application rollback.

Database rollback is a separate concern. Migrations must be backward compatible with the previous application version for safe rolling application rollback. Destructive production schema resets are forbidden.

## 13. Existing VPS NGINX and Cloudflare

`docker/nginx/vps-site.example.conf` will document the host-level configuration:

- Listen on public 443 with the Cloudflare Origin CA certificate and private key.
- Use Cloudflare Full (Strict), never Flexible mode.
- Proxy only to `http://127.0.0.1:8080`.
- Preserve host, scheme, client IP, and request ID using a trusted proxy chain.
- Trust client-IP headers only from current Cloudflare proxy ranges.
- Restrict origin access to Cloudflare IP ranges at the VPS firewall or NGINX layer when operationally feasible.
- Optionally enable Authenticated Origin Pulls for stronger Cloudflare-to-origin authentication.
- Redirect public port 80 to HTTPS or restrict it to the certificate/operational flow in use.
- Apply HSTS after validating the HTTPS configuration and subdomain implications.

Cloudflare IP ranges can change, so allowlists need a documented update procedure. A Cloudflare Tunnel is a future alternative if eliminating public origin ingress becomes desirable, but it is not required for this implementation.

## 14. Security threat study

| Threat or failure | Consequence | Mitigation in this plan |
| --- | --- | --- |
| Public PostgreSQL or Redis port | Credential attack, data theft, destructive access | No published ports; private `data_net`; host firewall |
| Public Vite, Node, or PHP-FPM ports | Bypass of gateway policy and headers | Only loopback Docker NGINX is published |
| Cloudflare Flexible TLS | Plain HTTP between Cloudflare and origin; redirect and cookie risks | Full (Strict) with Origin CA |
| Origin IP bypass | Attackers avoid Cloudflare controls | Cloudflare allowlist and optional authenticated origin pulls |
| Compromised application reaching every container | Larger blast radius | Segmented networks, separate database roles, Redis ACLs |
| Shared Redis key collision or command abuse | Cross-service data corruption | Per-service ACL users, command restrictions, namespaces |
| Secrets embedded in images or Compose metadata | Long-lived credential disclosure | Runtime secret mounts; templates only in Git |
| Root container escape or filesystem modification | Higher host and persistence risk | Non-root UID, dropped capabilities, no-new-privileges, read-only root FS |
| Supply-chain compromise | Malicious dependency or base layer | Lockfiles, digest pinning, minimal contexts, SBOM, image and dependency scanning |
| Stale packages in a pinned image | Known vulnerabilities persist indefinitely | Scheduled rebuild and digest-update process |
| NGINX prefix confusion | Requests reach wrong API or bypass policy | Exact route and slash-boundary tests |
| Proxy-header spoofing | Wrong scheme/IP, insecure URLs, audit corruption | Replace forwarding headers at trusted edges; explicit trusted proxies |
| Retry of a payment POST | Duplicate financial operation | No unsafe upstream retry; application idempotency keys required for payment commands |
| Migration run by every replica | Locking, race, inconsistent startup | One-shot migration service before rollout |
| Local media with multiple replicas | Missing files or divergent state | Shared persistent media volume; future object storage recommended |
| Redis eviction under pressure | Queue job or cache loss | Bounded memory with `noeviction`, monitoring, workload tuning |
| PostgreSQL connection exhaustion | Full API outage | Low FPM concurrency, bounded Node pool, modest `max_connections`, measure for PgBouncer |
| Unbounded logs | Disk exhaustion | Log rotation, stdout/stderr, monitoring |
| Oversized uploads/bodies | Memory, disk, and worker exhaustion | Route-specific limits, timeouts, validation, storage monitoring |
| SPA source maps and secrets | Client code disclosure | No production source maps; never put secrets in Vite variables |
| False sense of HA from replicas | Host failure still causes outage | Document single-host scope; external monitoring and backups |

Payment endpoints additionally require application-level idempotency, transaction boundaries, replay protection, authorization, audit records, and provider webhook signature verification. Those are payment-domain controls and must be implemented with the payment controllers; Docker and NGINX cannot provide them alone.

## 15. Performance bottlenecks and controls

### 15.1 1 vCPU contention

Likely bottleneck: parallel PHP, Node, builds, database work, and compression compete for one CPU.

Controls:

- Build images in CI rather than on the production VPS where possible.
- Keep PHP-FPM children and Node heap bounded.
- Avoid runtime TypeScript/Vite compilation in production.
- Prefer NGINX compression and cache static assets.
- Use load tests to find the useful concurrency point rather than increasing replicas blindly.

### 15.2 Memory pressure

Likely bottleneck: PHP workers, Node heap, PostgreSQL buffers, Redis fragmentation, and Docker overhead exceed the 2 GB stack budget.

Controls:

- Enforce service limits.
- Start with one PHP worker per API replica.
- Bound V8 old space.
- Leave Redis headroom between `maxmemory` and its container limit.
- Keep PostgreSQL connection count and memory-per-sort small.
- Alert on container OOM kills, Redis memory, PostgreSQL connections, and host swap pressure.

### 15.3 PostgreSQL connection pressure

Two API pools plus workers can open more connections than a small database can handle.

Controls:

- Calculate maximum PHP and Node connections from actual process counts.
- Keep Node ORM pools small.
- Avoid idle per-request connection proliferation.
- Add PgBouncer only if measurements show it is warranted.

### 15.4 Local media throughput and correctness

Laravel media is stateful and cannot live only in an individual container layer.

Controls:

- Shared persistent volume across Laravel and gateway paths.
- Explicit backup and restore procedure.
- Monitor disk capacity and inode usage.
- Prefer S3-compatible object storage if scaling beyond one host.

### 15.5 NGINX/Docker DNS lifecycle

Static resolution at NGINX startup can retain dead container IPs after recreation.

Controls:

- Use dynamic DNS re-resolution compatible with the selected NGINX syntax/version.
- Validate by recreating a replica without restarting the gateway.
- Treat passive failure handling as resilience, not active health checking.

### 15.6 Dashboard asset delivery

Controls:

- Hashed assets receive immutable caching.
- `index.html` remains quickly revalidated.
- Build output is compressed once and served by unprivileged NGINX.
- Bundle-size work remains a separate frontend optimization effort; containerization must not claim to solve large JavaScript or image assets.

## 16. Validation plan

### 16.1 Static configuration gates

- `docker compose -f docker-compose.dev.yml config`
- `docker compose -f docker-compose.yml config`
- `docker build --check` where supported.
- `nginx -t` for dashboard, Docker gateway, and VPS example configurations.
- Shell lint for entrypoints and initialization scripts.
- `git diff --check` from the repository root.
- Verify no real secret, `.env`, private key, or credential is in build contexts or Git.

### 16.2 Build and image gates

- Build every development and production target from a clean cache once.
- Rebuild with cache to verify useful layer reuse.
- Inspect image histories for secrets and unnecessary build tools.
- Confirm runtime users are non-root.
- Confirm production images contain no development dependencies, source maps, tests, or Git metadata.
- Generate SBOMs.
- Scan OS and application dependencies.
- Review image sizes and largest layers.

Point-in-time repository audits completed during planning:

- Dashboard production npm audit: no advisories.
- Payment API production npm audit: no advisories.
- Laravel Composer production audit: no advisories and no abandoned packages.

These results are not permanent guarantees; rerun them in CI and before deployment.

### 16.3 Application gates

- Run Laravel focused and full relevant tests in the containerized environment.
- Run NestJS tests and a production-start smoke test.
- Run the dashboard's official build command, including its typecheck gate.
- Confirm Laravel config, route, and view caches can be generated with production-style environment configuration.
- Confirm Horizon starts, processes a controlled test job, and exits gracefully.
- Confirm scheduler invokes `schedule:run` or `schedule:work` according to the chosen lifecycle.

### 16.4 Route matrix

Exercise at least:

| Request | Expected result |
| --- | --- |
| `GET /` | dashboard |
| `GET /login` | dashboard SPA fallback |
| `GET /assets/<hash>.js` | dashboard static asset |
| `POST /api/login` | Laravel |
| `GET /api/user` | Laravel |
| `GET /api/v1/leads` | Laravel |
| `GET /api/v1/payments` | NestJS |
| `GET /api/v1/payments/123` | NestJS |
| `GET /api/v1/payment` | Laravel or 404 from Laravel, never NestJS payments prefix |
| `GET /api/v1/payments-old` | Laravel or 404 from Laravel, never NestJS |
| `GET /api/v1/invoice` | NestJS |
| `GET /api/v1/invoice/123` | NestJS |
| `GET /api/v1/invoices` | Laravel or 404 from Laravel, never NestJS invoice prefix |
| `GET /storage/<known-file>` | shared Laravel media |
| unknown non-API route | dashboard `index.html` |

Verify that upstreams receive the original URI, host, scheme, client IP chain, and request ID as designed.

### 16.5 Isolation and security gates

- From outside Docker, confirm only public VPS ports and loopback `8080` exist as intended.
- From the dashboard container, confirm PostgreSQL and Redis are unreachable.
- From the gateway, confirm PostgreSQL and Redis are unreachable.
- Confirm CRM database credentials cannot access the payments database beyond deliberate grants.
- Confirm payment database credentials cannot access CRM data.
- Confirm each Redis user cannot access the other service's namespace or forbidden commands.
- Confirm containers cannot write source or configuration paths.
- Confirm containers cannot gain new privileges.
- Validate Cloudflare origin certificate, Full (Strict), real client IP handling, and direct-origin blocking.

### 16.6 Failure and recovery gates

- Stop one Laravel replica during traffic; requests continue through the other.
- Stop one NestJS replica during traffic; requests continue through the other.
- Recreate an application container and confirm NGINX discovers its new IP.
- Restart PostgreSQL and Redis and confirm readiness prevents premature traffic.
- Restart the entire Compose project and confirm database, Redis, and media persistence.
- Force an application timeout and confirm bounded gateway behavior.
- Confirm non-idempotent payment requests are not transparently replayed.
- Verify database and media backups by restoring into an isolated environment.

### 16.7 Load and resource gates

Run a representative mixed workload within the 2 GB budget:

- dashboard asset delivery;
- Laravel authenticated reads and representative writes;
- NestJS payment-route placeholders or implemented endpoints;
- queue processing;
- PostgreSQL and Redis activity.

Measure p50/p95/p99 latency, error rate, CPU saturation, memory and OOM events, PHP-FPM queueing, Node event-loop delay, database connections and slow queries, Redis latency/memory, NGINX upstream failures, and host disk pressure.

## 17. Implementation phases

### Phase 1: Baseline and contracts

1. Record current application commands, dependency requirements, health behavior, writable paths, upload limits, and environment variables.
2. Add `.dockerignore` files and environment/secret templates.
3. Add NestJS global prefix, dependency configuration, health endpoints, and graceful shutdown behavior with tests.
4. Confirm the exact Laravel media path and shared-volume behavior.

Exit condition: runtime contracts and all required configuration inputs are documented and testable without Docker routing.

### Phase 2: Development stack

1. Build the three development Dockerfiles.
2. Add Redis and PostgreSQL development configuration and initialization.
3. Add the development NGINX gateway and upstream pool file.
4. Add `docker-compose.dev.yml` with bind mounts, dependency volumes, health checks, and private networks.
5. Validate hot reload, Laravel API access, route ownership, shared Redis, and database isolation.

Exit condition: a new developer can start the complete stack through one documented Compose command, and only the loopback gateway is exposed.

### Phase 3: Production images

1. Build the hardened Laravel multi-stage image and process variants.
2. Build the hardened NestJS multi-stage image.
3. Build the Vite-to-unprivileged-NGINX dashboard image.
4. Pin base-image digests.
5. Add SBOM, vulnerability, non-root, filesystem, and content checks.

Exit condition: all production images are immutable, minimal, non-root, independently healthy, and reproducible from lockfiles.

### Phase 4: Production orchestration

1. Add production networks, secrets, named volumes, health checks, caps, and restart policies.
2. Add two application instances per user-facing service.
3. Add Horizon, scheduler, and one-shot migration services.
4. Add production gateway and dynamically resolved upstream pools.
5. Test routing boundaries, replica loss, container recreation, and persistence.

Exit condition: the full stack passes the route, isolation, recovery, and resource gates on a staging-equivalent host.

### Phase 5: VPS edge and rollout

1. Install the Cloudflare Origin CA certificate on the VPS.
2. Configure existing VPS NGINX to proxy to loopback Docker NGINX.
3. Enable Cloudflare Full (Strict).
4. Validate real IP handling, timeouts, body limits, and TLS.
5. Restrict direct-origin access to Cloudflare ranges; evaluate authenticated origin pulls.
6. Perform backups and a restore rehearsal.
7. Deploy with migration, smoke test, monitoring, and rollback checkpoints.

Exit condition: production traffic reaches only the intended route owners, direct service exposure is absent, monitoring is live, and rollback has been rehearsed.

## 18. Operational documentation to add with implementation

`docs/docker-operations.md` should contain:

- prerequisites and secret-file creation;
- development start, stop, logs, rebuild, and test commands;
- explicit warning and command for destructive development reset;
- production build and deployment sequence;
- safe migration procedure;
- replica replacement and NGINX reload procedure;
- log and health inspection;
- PostgreSQL, Redis, and media backup/restore;
- credential and Origin CA rotation;
- Cloudflare IP allowlist maintenance;
- image digest and dependency update cadence;
- rollback steps and database compatibility limitations;
- common failure diagnosis.

## 19. Explicit non-goals

- Multi-host or multi-region high availability.
- PostgreSQL replication or automated failover.
- Redis Sentinel or Redis Cluster.
- Kubernetes or Docker Swarm orchestration.
- Inventing payment business endpoints.
- Implementing payment-domain idempotency and webhook logic without its domain requirements.
- Exposing database or cache ports for convenience.
- Automatically running destructive development resets.
- Claiming container replicas solve a VPS, disk, database, or Redis failure.

## 20. Research sources

Primary documentation consulted for this design:

- [Docker build best practices](https://docs.docker.com/build/building/best-practices/)
- [Docker Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)
- [Docker Compose startup order and health dependencies](https://docs.docker.com/compose/how-tos/startup-order/)
- [Docker bridge networks](https://docs.docker.com/engine/network/drivers/bridge/)
- [Docker container resource constraints](https://docs.docker.com/engine/containers/resource_constraints/)
- [NGINX upstream module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html)
- [NGINX FastCGI module](https://nginx.org/en/docs/http/ngx_http_fastcgi_module.html)
- [NGINX proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Laravel deployment documentation](https://laravel.com/docs/13.x/deployment)
- [Laravel Horizon documentation](https://laravel.com/docs/13.x/horizon)
- [NestJS global prefix](https://docs.nestjs.com/faq/global-prefix)
- [NestJS health checks with Terminus](https://docs.nestjs.com/recipes/terminus)
- [NestJS Helmet guidance](https://docs.nestjs.com/security/helmet)
- [NestJS compression guidance](https://docs.nestjs.com/techniques/compression)
- [Redis ACL documentation](https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/)
- [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
- [Redis eviction behavior](https://redis.io/docs/latest/develop/reference/eviction/)
- [PostgreSQL password authentication](https://www.postgresql.org/docs/current/auth-password.html)
- [PostgreSQL SSL support](https://www.postgresql.org/docs/current/ssl-tcp.html)
- [Vite static deployment](https://vite.dev/guide/static-deploy.html)
- [Vite development server options](https://vite.dev/config/server-options)
- [Cloudflare Full (Strict) mode](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/)
- [Cloudflare Origin CA](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/)
- [Cloudflare authenticated origin pulls](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/)

## 21. Final acceptance criteria

Implementation is complete only when all of the following are true:

- Every requested development and production file exists and is documented.
- Only Docker NGINX is published, and only on `127.0.0.1:8080`.
- Exact payment and invoice prefixes reach NestJS; every other `/api/*` route reaches Laravel.
- Non-API routes reach the dashboard and `/storage/*` reaches shared Laravel media.
- Laravel, NestJS, and dashboard each operate as a two-instance production pool.
- PostgreSQL roles/databases and Redis ACLs/namespaces isolate CRM from payments.
- Production images are multi-stage, non-root, digest-pinned, scanned, and free of embedded secrets and development dependencies.
- The stack stays within its measured resource budget under representative load.
- Health, readiness, graceful shutdown, replica-loss, DNS-recreation, backup/restore, and persistence tests pass.
- Cloudflare-to-origin TLS uses Full (Strict), and the public origin cannot bypass the intended edge controls.
- Operations documentation supports repeatable development, deployment, recovery, rotation, and rollback.

