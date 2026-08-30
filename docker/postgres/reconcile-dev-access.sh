#!/bin/sh
set -eu

# Development-only startup reconciliation for persistent PostgreSQL volumes.
# It restores the ownership that the one-time init hook establishes on a fresh
# volume, without deleting data or terminating database clients.

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

export PGPASSWORD="$(read_value POSTGRES_PASSWORD)"

psql -X -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-postgres}" --dbname postgres \
    --set=crm_db_name="$crm_db_name" \
    --set=crm_db_user="$crm_db_user" \
    --set=crm_db_password="$crm_db_password" \
    --set=payments_db_name="$payments_db_name" \
    --set=payments_db_user="$payments_db_user" \
    --set=payments_db_password="$payments_db_password" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'crm_db_user', :'crm_db_password')
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :'crm_db_user')\gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'crm_db_user', :'crm_db_password')\gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'crm_db_name', :'crm_db_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'crm_db_name')\gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'crm_db_name', :'crm_db_user')
WHERE EXISTS (
    SELECT 1
    FROM pg_database
    WHERE datname = :'crm_db_name'
      AND datdba <> (:'crm_db_user')::regrole
)\gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'payments_db_user', :'payments_db_password')
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :'payments_db_user')\gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'payments_db_user', :'payments_db_password')\gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'payments_db_name', :'payments_db_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'payments_db_name')\gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'payments_db_name', :'payments_db_user')
WHERE EXISTS (
    SELECT 1
    FROM pg_database
    WHERE datname = :'payments_db_name'
      AND datdba <> (:'payments_db_user')::regrole
)\gexec
SQL

reconcile_database() {
    database_name="$1"
    database_user="$2"

    echo "Reconciling ${database_name} ownership for ${database_user}."

    psql -X -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-postgres}" --dbname "$database_name" \
        --set=database_user="$database_user" <<'SQL'
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Report real blocking chains. PostgreSQL restart clears locks, so this
-- reconciler deliberately never terminates sessions.
SELECT
    waiting.pid AS waiting_pid,
    waiting.usename AS waiting_user,
    waiting.query AS waiting_query,
    pg_blocking_pids(waiting.pid) AS blocking_pids
FROM pg_stat_activity AS waiting
WHERE waiting.datname = current_database()
  AND waiting.pid <> pg_backend_pid()
  AND cardinality(pg_blocking_pids(waiting.pid)) > 0;

SELECT format('ALTER SCHEMA public OWNER TO %I', :'database_user')
FROM pg_namespace
WHERE nspname = 'public'
  AND nspowner <> (:'database_user')::regrole\gexec

SELECT format(
    'ALTER %s %s OWNER TO %I',
    CASE WHEN relation.relkind = 'S' THEN 'SEQUENCE' ELSE 'TABLE' END,
    relation.oid::regclass,
    :'database_user'
)
FROM pg_class AS relation
JOIN pg_namespace AS schema ON schema.oid = relation.relnamespace
WHERE schema.nspname = 'public'
  AND relation.relkind IN ('r', 'p', 'S')
  AND relation.relowner <> (:'database_user')::regrole
-- Tables must run before their owned serial/identity sequences: PostgreSQL
-- transfers those sequence owners as part of ALTER TABLE ... OWNER TO.
ORDER BY CASE WHEN relation.relkind = 'S' THEN 1 ELSE 0 END, relation.oid::regclass::text\gexec

SELECT CASE
    WHEN has_schema_privilege(:'database_user', 'public', 'USAGE, CREATE')
     AND NOT EXISTS (
        SELECT 1
        FROM pg_class AS relation
        JOIN pg_namespace AS schema ON schema.oid = relation.relnamespace
        WHERE schema.nspname = 'public'
          AND relation.relkind IN ('r', 'p', 'S')
          AND relation.relowner <> (:'database_user')::regrole
     )
    THEN 'true'
    ELSE 'false'
END AS reconciliation_verified\gset
\if :reconciliation_verified
\else
    \quit 3
\endif

COMMIT;
SQL
}

reconcile_database "$crm_db_name" "$crm_db_user"
reconcile_database "$payments_db_name" "$payments_db_user"

auth_tables_ready="$(psql -X -At -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-postgres}" --dbname "$crm_db_name" -c "SELECT to_regclass('public.personal_access_tokens') IS NOT NULL AND to_regclass('public.users') IS NOT NULL AND to_regclass('public.roles') IS NOT NULL AND to_regclass('public.permissions') IS NOT NULL AND to_regclass('public.model_has_roles') IS NOT NULL AND to_regclass('public.model_has_permissions') IS NOT NULL AND to_regclass('public.role_has_permissions') IS NOT NULL")"

if [ "$auth_tables_ready" = "t" ]; then
    echo 'Reconciling CRM auth-reader and auth-seeder grants.'
    /bin/sh /usr/local/bin/grant-auth-access
else
    echo 'CRM auth tables are not present yet; auth grants will be reconciled on the next development start.'
fi
