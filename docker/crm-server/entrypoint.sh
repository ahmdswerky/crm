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

if [ -n "${APP_KEY_FILE:-}" ]; then
    export APP_KEY="$(read_secret "$APP_KEY_FILE")"
fi
if [ -n "${DB_PASSWORD_FILE:-}" ]; then
    export DB_PASSWORD="$(read_secret "$DB_PASSWORD_FILE")"
fi
if [ -n "${REDIS_PASSWORD_FILE:-}" ]; then
    export REDIS_PASSWORD="$(read_secret "$REDIS_PASSWORD_FILE")"
fi
if [ -n "${RABBITMQ_PASSWORD_FILE:-}" ]; then
    export RABBITMQ_PASSWORD="$(read_secret "$RABBITMQ_PASSWORD_FILE")"
fi

mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs storage/media-library/temp bootstrap/cache

php artisan config:cache --ansi
php artisan route:cache --ansi
php artisan view:cache --ansi

exec "$@"
