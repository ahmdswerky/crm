#!/bin/sh
set -eu

if [ -n "${RABBITMQ_BOOTSTRAP_PASSWORD_FILE:-}" ]; then
    if [ ! -r "$RABBITMQ_BOOTSTRAP_PASSWORD_FILE" ]; then
        echo "Missing RabbitMQ password file: $RABBITMQ_BOOTSTRAP_PASSWORD_FILE" >&2
        exit 1
    fi
    export RABBITMQ_BOOTSTRAP_PASSWORD="$(tr -d '\r\n' < "$RABBITMQ_BOOTSTRAP_PASSWORD_FILE")"
    unset RABBITMQ_BOOTSTRAP_PASSWORD_FILE
fi

exec /usr/local/bin/docker-entrypoint.sh "$@"
