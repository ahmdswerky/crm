#!/usr/bin/env bash

# Source this file from Bash to use the development Docker shortcuts.
# shellcheck shell=bash

_CRM_DOCKER_SHORTCUTS_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

unalias art down up exec fresh 2>/dev/null || true

_crm_docker_compose_dev() {
    docker compose \
        --env-file "${_CRM_DOCKER_SHORTCUTS_ROOT}/.env.docker" \
        -f "${_CRM_DOCKER_SHORTCUTS_ROOT}/docker-compose.dev.yml" \
        "$@"
}

art() {
    _crm_docker_compose_dev exec crm-api php artisan "$@"
}

down() {
    _crm_docker_compose_dev down "$@"
}

up() {
    _crm_docker_compose_dev up -d "$@"
}

# Intentionally overrides the shell builtin. Use `command exec` when the
# process-replacement builtin is needed.
exec() {
    _crm_docker_compose_dev exec "$@"
}

fresh() {
    local start_days start_date

    # Destructive: removes the development database, Redis, media, and
    # dependency volumes before recreating and reseeding the stack.
    down -v --remove-orphans || return
    _crm_docker_compose_dev up -d --wait || return

    art migrate:fresh --seed || return
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
