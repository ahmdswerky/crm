#!/bin/sh
set -eu

if [ -n "${RABBITMQ_BOOTSTRAP_PASSWORD_FILE:-}" ]; then
    if [ ! -r "$RABBITMQ_BOOTSTRAP_PASSWORD_FILE" ]; then
        echo "Missing RabbitMQ password file: $RABBITMQ_BOOTSTRAP_PASSWORD_FILE" >&2
        exit 1
    fi
    RABBITMQ_BOOTSTRAP_PASSWORD="$(tr -d '\r\n' < "$RABBITMQ_BOOTSTRAP_PASSWORD_FILE")"
    unset RABBITMQ_BOOTSTRAP_PASSWORD_FILE
fi

: "${RABBITMQ_BOOTSTRAP_USER:?RABBITMQ_BOOTSTRAP_USER is required}"
: "${RABBITMQ_BOOTSTRAP_PASSWORD:?RABBITMQ_BOOTSTRAP_PASSWORD is required}"

json_escape() { printf '%s' "$1" | sed 's/[\\"]/\\&/g'; }

user="$(json_escape "$RABBITMQ_BOOTSTRAP_USER")"
password="$(json_escape "$RABBITMQ_BOOTSTRAP_PASSWORD")"

# ponytail: prepend users/permissions onto the static topology instead of a JSON
# merge tool (no jq in the image); tail -c +2 drops the topology's opening brace.
# Written to /tmp (tmpfs in production) so the password never lands on the data volume.
definitions=/tmp/definitions.json
umask 077
{
    printf '{\n'
    printf '  "users": [ { "name": "%s", "password": "%s", "tags": ["administrator"] } ],\n' "$user" "$password"
    printf '  "permissions": [ { "user": "%s", "vhost": "/", "configure": ".*", "write": ".*", "read": ".*" } ],\n' "$user"
    tail -c +2 /etc/rabbitmq/topology.json
} > "$definitions"
chown rabbitmq:rabbitmq "$definitions"

unset RABBITMQ_BOOTSTRAP_PASSWORD

exec /usr/local/bin/docker-entrypoint.sh "$@"
