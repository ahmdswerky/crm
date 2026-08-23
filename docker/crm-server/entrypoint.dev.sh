#!/bin/sh
set -eu

max_children="${PHP_FPM_MAX_CHILDREN:-4}"

case "$max_children" in
    ''|*[!0-9]*)
        echo "PHP_FPM_MAX_CHILDREN must be a positive integer" >&2
        exit 1
        ;;
esac

if [ "$max_children" -lt 1 ] || [ "$max_children" -gt 32 ]; then
    echo "PHP_FPM_MAX_CHILDREN must be between 1 and 32" >&2
    exit 1
fi

pool_config=/tmp/crm-www.conf
fpm_config=/tmp/php-fpm.conf

sed "s/^pm\.max_children[[:space:]]*=.*/pm.max_children = $max_children/" \
    /usr/local/etc/php-fpm.d/zz-crm.conf > "$pool_config"

printf '%s\n' \
    '[global]' \
    'error_log = /proc/self/fd/2' \
    "include = $pool_config" > "$fpm_config"

if [ "${1:-}" = 'php-fpm' ]; then
    shift
    exec php-fpm -y "$fpm_config" "$@"
fi

exec "$@"
