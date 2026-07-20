#!/usr/bin/env bash
# =============================================================================
# Pruebas de base de datos sobre PostgreSQL local SIN Docker.
# =============================================================================
# Crea un clúster efímero, aplica el shim de Supabase (scripts/db/supabase-shim.sql),
# ejecuta todas las migraciones desde cero y corre las pruebas pgTAP.
# Es el plan B documentado en docs/database/local-testing.md; el entorno
# canónico sigue siendo `pnpm db:start` + `pnpm db:test` (Supabase CLI + Docker).
#
# Requisitos: postgresql-16 y postgresql-16-pgtap instalados (pg_prove incluido).
# Uso: bash scripts/db/test-local-pg.sh [--keep] [archivo_de_prueba...]
#   --keep  deja el clúster corriendo (imprime la URL) para inspección manual.
# =============================================================================
set -euo pipefail

# PostgreSQL no puede ejecutarse como root: re-ejecutar como usuario postgres.
if [[ "$(id -u)" -eq 0 ]] && id postgres >/dev/null 2>&1; then
  exec runuser -u postgres -- bash "$0" "$@"
fi

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PORT="${DTPG_PORT:-55432}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DATA="$(mktemp -d)"
KEEP=0
if [[ "${1:-}" == "--keep" ]]; then KEEP=1; shift; fi
TESTS=("$@")
if [[ ${#TESTS[@]} -eq 0 ]]; then TESTS=("$ROOT"/supabase/tests/database/*.sql); fi

cleanup() {
  if [[ "$KEEP" -eq 0 ]]; then
    "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
    rm -rf "$DATA"
  fi
}
trap cleanup EXIT

echo "→ Inicializando clúster efímero (puerto $PORT)"
"$PGBIN/initdb" -D "$DATA" -U postgres -A trust -E UTF8 >/dev/null
"$PGBIN/pg_ctl" -D "$DATA" -l "$DATA/postgres.log" \
  -o "-p $PORT -k $DATA -c listen_addresses=127.0.0.1" start >/dev/null

export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres

echo "→ Aplicando shim de entorno Supabase"
psql -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/db/supabase-shim.sql"

echo "→ Aplicando migraciones desde cero"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "   · $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "→ Ejecutando pruebas pgTAP"
pg_prove --host 127.0.0.1 --port "$PORT" --username postgres --dbname postgres "${TESTS[@]}"

if [[ "$KEEP" -eq 1 ]]; then
  echo "→ Clúster activo en postgresql://postgres@127.0.0.1:$PORT/postgres (datos en $DATA)"
  echo "   Detén con: $PGBIN/pg_ctl -D $DATA stop"
fi
