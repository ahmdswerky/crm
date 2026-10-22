# Prod compose optimization: fewer builds, less disk, bounded RAM

Status: proposed, awaiting approval (2026-10-22). Visual version: [plan.html](plan.html).

## Context

Prod host: 2 GB RAM + 4 GB swap, Podman (`podman-compose 1.5.0`), builds on the server.

Problems found:
- **11 `build:` blocks for 3 Dockerfiles.** The crm-server Dockerfile is used 6×, payment 3×, dashboard 2×. `podman-compose build` starts **every** build at the same time (`compose_build` → one `asyncio.create_task` per container, `/usr/lib/python3/dist-packages/podman_compose.py:2981`). On a 2 GB box that means 6 PHP extension compiles + 3 `npm ci` + 2 vite builds at once, so it swaps or gets OOM-killed. It also leaves 11 image tags behind.
- **No memory caps.** One runaway container (Horizon goes up to 10 PHP workers, `crm-server/config/horizon.php:218`) can starve postgres and redis.
- **Container logs are unbounded** (no `logging:` anywhere).
- **Rebuilds always recompute the dashboard ERDs.** Any dashboard source change re-downloads `@liam-hq/cli` and rebuilds the ERDs, because the ERD step comes after `COPY dashboard/ .`.
- **A fixed image tag breaks redeploys.** podman-compose decides whether to recreate a container by comparing config hashes. With the same `image:` tag, a rebuilt image never gets deployed unless you pass `--force-recreate`.

Decisions (approved): build on the server, one build per image; keep all replicas; cap Horizon through an env var.

## Steps

### 1. One build per image (`docker-compose.yml`)
- Image names (the `localhost/` prefix makes podman resolve them locally and never pull):
  - `localhost/crm-server:${IMAGE_TAG:-latest}`
  - `localhost/crm-payment:${IMAGE_TAG:-latest}`
  - `localhost/crm-dashboard:${IMAGE_TAG:-latest}`
- Keep `build:` on one always-active service per image: `crm-migrate`, `payment-api-1`, `dashboard-1` (with `args`).
- Every other service (`crm-api-1/2`, `payment-events`, `horizon`, `scheduler`, `payment-api-2`, `payment-auth-seed`, `dashboard-2`) gets `image:` only and its `build:` block is deleted.
- Result: 11 builds become 3, and 11 image tags become 3.
- Docker Compose v2 skips pulling images that another service builds, so the Docker path keeps working too.

### 2. Bounded logs (`docker-compose.yml`)
- Add `x-logging: &logging {driver: json-file, options: {max-size: "10m"}}`. Podman treats `json-file` as an alias of `k8s-file` and supports `max-size`; podman-compose passes both through (`podman_compose.py:1185`).
- Reference it from `x-app-defaults`, and add `logging: *logging` to `crm-migrate`, `postgres`, `redis`, `rabbitmq` and `gateway`.
- Ceiling is about 10 MB × 17 containers.

### 3. Memory caps (`mem_limit`, `docker-compose.yml`)
These are ceilings, not reservations, sized against the existing app limits (PHP `memory_limit=256M`, Node heap 128 MB, PG `shared_buffers=96MB`, Redis `maxmemory 96mb`):

| service | cap |
| --- | --- |
| crm-api-1/2 | 320m |
| horizon | 384m |
| scheduler | 256m |
| payment-events | 192m |
| crm-migrate | 384m |
| auth-grants | 64m |
| payment-api-1/2 | 256m |
| payment-auth-seed | 192m |
| dashboard-1/2 | 32m |
| gateway | 64m |
| postgres | 320m |
| redis | 192m |
| rabbitmq | 384m |

- Swap stays available. Docker and Podman both default swap to 2× `mem_limit`.
- `cpus` is skipped on purpose: rootless podman often lacks a delegated `cpu` controller and would fail container start.

### 4. RabbitMQ watermark (`docker/rabbitmq/rabbitmq.conf`)
- Add `vm_memory_high_watermark.absolute = 256MiB`. Without it the broker sizes its watermark from host RAM, overshoots the 384m cap and gets OOM-killed instead of throttling publishers.
- Harmless in dev.

### 5. Horizon worker cap
- `crm-server/config/horizon.php:218`: `'maxProcesses' => (int) env('HORIZON_MAX_PROCESSES', 10),`. Default unchanged.
- Add `HORIZON_MAX_PROCESSES: ${HORIZON_MAX_PROCESSES:-2}` to the `&crm-environment` anchor (one line; ignored by non-Horizon containers).

### 6. Dashboard ERD stage (`docker/dashboard/Dockerfile`)
- Move the liam loop into its own `erd` stage (`FROM node…`, `COPY docs/db /docs/db`, output to `/erd/$name`).
- The build stage then does `COPY --from=erd /erd public/docs/db` before `npm run build`.
- The ERD layer is then cached on `docs/db` alone; dashboard edits no longer re-download liam.
- Keep the existing "kept in step with…" comment.

### 7. `.dockerignore`
- Add `.secrets`, `.worktrees`, `.claude`, `.gemini`, `.agents`, `api-testing`, `dashboard/screenshots` (14 MB, only used by `scripts/capture-routes.mjs`).
- This gives smaller COPY layers and keeps secrets out of the build context.

### 8. Deploy and cleanup commands (`docs/docker-operations.md`, Podman production section)
```sh
export IMAGE_TAG="$(git rev-parse --short HEAD)"   # new tag ⇒ podman-compose recreates app containers
P="podman-compose --env-file .env.docker -f docker-compose.podman.yml"
$P build crm-migrate && $P build payment-api-1 && $P build dashboard-1   # one at a time on a 2 GB host
$P up -d
# after health + smoke checks pass: drop previous release tags, keep build cache
podman images --format '{{.Repository}}:{{.Tag}}' | grep -E '^localhost/crm-(server|payment|dashboard):' | grep -v ":$IMAGE_TAG\$" | xargs -r podman rmi
# monthly or when `podman system df` grows: clear stale build cache (next build is a full rebuild)
podman image prune -f
```
- Add `HORIZON_MAX_PROCESSES` and `IMAGE_TAG` to `.env.docker.example` (commented, with defaults).
- Note: with `IMAGE_TAG` unset (`latest`), `up -d` needs `--force-recreate` after a rebuild.

## Critical files
- `docker-compose.yml` (steps 1–3, 5)
- `docker/rabbitmq/rabbitmq.conf` (step 4)
- `crm-server/config/horizon.php` (step 5)
- `docker/dashboard/Dockerfile` (step 6)
- `.dockerignore` (step 7)
- `docs/docker-operations.md` and `.env.docker.example` (step 8)
- `docker-compose.podman.yml`: no change needed; it just includes the main file.

## Verification
1. `docker compose -f docker-compose.yml config -q` and `npm run quality:docker` (same checks as CI).
2. `podman-compose --dry-run -f docker-compose.podman.yml build`: exactly 3 `podman build` commands.
3. `podman-compose -f docker-compose.podman.yml config | grep -E 'image:|mem_limit'`: shared image names and caps rendered.
4. Build the dashboard and confirm the ERDs are present:
   - `podman run --rm --entrypoint ls localhost/crm-dashboard:latest /usr/share/nginx/html/docs/db/crm`
   - Touch a dashboard src file, rebuild, and confirm the `erd` stage reports cache hits.
5. Local `up -d`:
   - `podman stats --no-stream` shows a MEM LIMIT per container.
   - `podman inspect -f '{{.HostConfig.LogConfig}}' <gateway>` shows k8s-file with max-size 10m.
   - `curl -fsS http://127.0.0.1:8080/healthz`.
   - Horizon dashboard shows ≤2 processes.
6. Pre-check on prod if rootless: `cat /sys/fs/cgroup/user.slice/user-$(id -u).slice/user@$(id -u).service/cgroup.controllers` must list `memory`.

## Out of scope (noticed, not touching)
- **Warning:** `deploy.sh` runs `art migrate:fresh --seed` on the server, which wipes the CRM database on every deploy.
- RabbitMQ definitions: `entrypoint.sh` now generates `/tmp/definitions.json` (bootstrap user + `topology.json`, tmpfs in production) at boot, and `rabbitmq.conf` loads it. The old duplicate `definitions.json` is deleted. The management plugin is unused in prod; switching to the plain `-alpine` image would need the `management.load_definitions` key changed to core `load_definitions`.
