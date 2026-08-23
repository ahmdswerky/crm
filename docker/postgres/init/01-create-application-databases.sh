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

crm_db_name="${CRM_DB_NAME:-crm}"
crm_db_user="${CRM_DB_USER:-crm_app}"
crm_db_password="$(read_value CRM_DB_PASSWORD)"
payments_db_name="${PAYMENTS_DB_NAME:-payments}"
payments_db_user="${PAYMENTS_DB_USER:-payments_app}"
payments_db_password="$(read_value PAYMENTS_DB_PASSWORD)"
auth_db_user="${AUTH_DB_USER:-auth_reader}"
auth_db_password="$(read_value AUTH_DB_PASSWORD)"
auth_seed_db_user="${AUTH_SEED_DB_USER:-auth_seeder}"
auth_seed_db_password="$(read_value AUTH_SEED_DB_PASSWORD)"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
    --set=crm_db_name="$crm_db_name" \
    --set=crm_db_user="$crm_db_user" \
    --set=crm_db_password="$crm_db_password" \
    --set=payments_db_name="$payments_db_name" \
    --set=payments_db_user="$payments_db_user" \
    --set=payments_db_password="$payments_db_password" \
    --set=auth_db_user="$auth_db_user" \
    --set=auth_db_password="$auth_db_password" \
    --set=auth_seed_db_user="$auth_seed_db_user" \
    --set=auth_seed_db_password="$auth_seed_db_password" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'crm_db_user', :'crm_db_password')
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :'crm_db_user')\gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'crm_db_user', :'crm_db_password')\gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'crm_db_name', :'crm_db_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'crm_db_name')\gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'payments_db_user', :'payments_db_password')
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :'payments_db_user')\gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'payments_db_user', :'payments_db_password')\gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'payments_db_name', :'payments_db_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'payments_db_name')\gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'auth_db_user', :'auth_db_password')
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :'auth_db_user')\gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'auth_db_user', :'auth_db_password')\gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'auth_seed_db_user', :'auth_seed_db_password')
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :'auth_seed_db_user')\gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'auth_seed_db_user', :'auth_seed_db_password')\gexec

REVOKE ALL ON DATABASE postgres FROM PUBLIC;
SQL
