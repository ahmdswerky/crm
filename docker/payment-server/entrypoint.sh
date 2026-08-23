#!/bin/sh
set -eu

read_secret() {
    value_file="$1"
    if [ ! -r "$value_file" ]; then
        echo "Missing secret file: $value_file" >&2
        exit 1
    fi
    tr -d '\r\n' < "$value_file"
}

if [ -n "${PAYMENTS_DB_PASSWORD_FILE:-}" ]; then
    export PAYMENTS_DB_PASSWORD="$(read_secret "$PAYMENTS_DB_PASSWORD_FILE")"
fi
if [ -n "${PAYMENTS_AUTH_DB_PASSWORD_FILE:-}" ]; then
    export PAYMENTS_AUTH_DB_PASSWORD="$(read_secret "$PAYMENTS_AUTH_DB_PASSWORD_FILE")"
fi
if [ -n "${PAYMENTS_REDIS_PASSWORD_FILE:-}" ]; then
    export PAYMENTS_REDIS_PASSWORD="$(read_secret "$PAYMENTS_REDIS_PASSWORD_FILE")"
fi
if [ -n "${RABBITMQ_PASSWORD_FILE:-}" ]; then
    export RABBITMQ_PASSWORD="$(read_secret "$RABBITMQ_PASSWORD_FILE")"
fi

exec "$@"
