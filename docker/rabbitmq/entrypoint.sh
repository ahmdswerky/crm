#!/bin/sh
set -eu

if [ -n "${RABBITMQ_DEFAULT_PASS_FILE:-}" ]; then
    if [ ! -r "$RABBITMQ_DEFAULT_PASS_FILE" ]; then
        echo "Missing RabbitMQ password file: $RABBITMQ_DEFAULT_PASS_FILE" >&2
        exit 1
    fi
    export RABBITMQ_DEFAULT_PASS="$(tr -d '\r\n' < "$RABBITMQ_DEFAULT_PASS_FILE")"
fi

exec /usr/local/bin/docker-entrypoint.sh "$@"
