#!/usr/bin/env zsh

# Source this file from Zsh to use the development Docker shortcuts.

_CRM_DOCKER_SHORTCUTS_ROOT="${${(%):-%x}:A:h:h}"

if [ -n "$1" ]; then
    IS_PODMAN=true
    DOCKER_TOOL="$(whereis podman-compose)"
    echo "Podman: Enabled"
else
    DOCKER_TOOL="$(docker compose)"
    IS_PODMAN=false
fi

# $DOCKER_TOOL --help

unalias art down up exec fresh tin 2>/dev/null || true

_crm_docker_compose_dev() {
    docker compose \
        --env-file "${_CRM_DOCKER_SHORTCUTS_ROOT}/.env.docker" \
        -f "${_CRM_DOCKER_SHORTCUTS_ROOT}/docker-compose.dev.yml" \
        "$@"
}

art() {
    _crm_docker_compose_dev exec crm-api php artisan "$@"
}

tin() {
    _crm_docker_compose_dev exec -e XDG_CONFIG_HOME=/tmp/psysh crm-api php artisan tinker "$@"
}

ps() {
    _crm_docker_compose_dev ps "$@"
}

down() {
    _crm_docker_compose_dev down "$@"
}

up() {
    _crm_docker_compose_dev up -d "$@"
}

# Intentionally overrides the shell builtin. Use `command exec` when the
# process-replacement builtin is needed.
dx() {
    _crm_docker_compose_dev exec "$@"
}

# Intentionally overrides the shell builtin. Use `command exec` when the
# process-replacement builtin is needed.
logs() {
    _crm_docker_compose_dev logs -f "$@"
}

bull() {
    npx concurrently \
      --names "payments,crm" \
      --prefix-colors "blue,magenta" \
      "BULL_BOARD_REDIS_URL=\"redis://payments:${PAYMENTS_REDIS_PASSWORD:-payments-redis-dev-password}@127.0.0.1:16379\" npx @bull-board/cli --prefix payments --queues payments --host 127.0.0.1 --port 3001 --read-only --no-open" \
      "BULL_BOARD_REDIS_URL=\"redis://crm:${CRM_REDIS_PASSWORD:-crm-redis-dev-password}@127.0.0.1:16379\" npx @bull-board/cli --prefix crm --host 127.0.0.1 --port 3002 --read-only --no-open"
}

fresh() {
    local start_days start_date

    # Destructive: removes the development database, Redis, media, and
    # dependency volumes before recreating and reseeding the stack.
    down -v --remove-orphans || return
    _crm_docker_compose_dev up -d --wait || return

    art migrate:fresh --seed || return
    _crm_docker_compose_dev --profile auth run --rm auth-grants || return
    _crm_docker_compose_dev --profile auth --profile seed run --rm payment-auth-seed || return
    art commission:recalculate --all || return
    art analytics:dispatch-due || return

    start_days="$(_crm_docker_compose_dev exec -T -e XDG_CONFIG_HOME=/tmp/psysh crm-api php artisan tinker --execute "echo config('crm.seeds.period.start')" | tr -d '[:space:]')"
    case "$start_days" in
        ''|*[!0-9]*)
            echo "Unable to read a valid CRM seed period: ${start_days:-<empty>}" >&2
            return 1
            ;;
    esac

    start_date="$(date -d "${start_days} days ago" +%Y-%m-%d)" || return
    art analytics:backfill --from="$start_date"
}
