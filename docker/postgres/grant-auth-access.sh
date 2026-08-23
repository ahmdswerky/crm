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

admin_password="$(read_value POSTGRES_PASSWORD)"
auth_password="$(read_value AUTH_DB_PASSWORD)"
auth_seed_password="$(read_value AUTH_SEED_PASSWORD)"

export PGPASSWORD="$admin_password"

psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-postgres}" --dbname postgres \
    --set=crm_db_name="${CRM_DB_NAME:-crm}" \
    --set=auth_db_user="${AUTH_DB_USER:-auth_reader}" \
    --set=auth_db_password="$auth_password" \
    --set=auth_seed_db_user="${AUTH_SEED_DB_USER:-auth_seeder}" \
    --set=auth_seed_db_password="$auth_seed_password" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'auth_db_user', :'auth_db_password')
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :'auth_db_user')\gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'auth_db_user', :'auth_db_password')\gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'auth_seed_db_user', :'auth_seed_db_password')
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :'auth_seed_db_user')\gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'auth_seed_db_user', :'auth_seed_db_password')\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I, %I', :'crm_db_name', :'auth_db_user', :'auth_seed_db_user')\gexec
SQL

psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-postgres}" \
    --dbname "${CRM_DB_NAME:-crm}" \
    --set=auth_db_user="${AUTH_DB_USER:-auth_reader}" \
    --set=auth_seed_db_user="${AUTH_SEED_DB_USER:-auth_seeder}" <<'SQL'
GRANT USAGE ON SCHEMA public TO :"auth_db_user", :"auth_seed_db_user";
GRANT SELECT ON TABLE
    personal_access_tokens,
    users,
    roles,
    permissions,
    model_has_roles,
    model_has_permissions,
    role_has_permissions
  TO :"auth_db_user";
GRANT SELECT ON TABLE
    roles,
    permissions,
    role_has_permissions
  TO :"auth_seed_db_user";
GRANT INSERT ON TABLE permissions, role_has_permissions TO :"auth_seed_db_user";
GRANT USAGE, SELECT ON SEQUENCE permissions_id_seq TO :"auth_seed_db_user";
SQL
