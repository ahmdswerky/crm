#!/bin/sh
set -eu

read_value() {
    name="$1"
    file_name="${name}_FILE"
    eval "file=\${$file_name:-}"
    if [ -n "$file" ] && [ -r "$file" ]; then
        tr -d '\r\n' < "$file"
    else
        eval "printf '%s' \"\${$name:-}\""
    fi
}

acl_file=/tmp/users.acl
crm_password="$(read_value CRM_REDIS_PASSWORD)"
payments_password="$(read_value PAYMENTS_REDIS_PASSWORD)"

if [ -z "$crm_password" ] || [ -z "$payments_password" ]; then
    echo 'Both Redis ACL passwords are required.' >&2
    exit 1
fi

umask 077
crm_commands='+@all -@dangerous'
if [ "${CRM_REDIS_ALLOW_FLUSHDB:-0}" = '1' ]; then
    crm_commands="$crm_commands +flushdb"
fi
{
    echo 'user default off'
    printf 'user crm on >%s ~crm:* &crm:* %s +info\n' "$crm_password" "$crm_commands"
    printf 'user payments on >%s ~payments:* &payments:* +@all -@dangerous +info\n' "$payments_password"
} > "$acl_file"

exec "$@" --aclfile "$acl_file"
