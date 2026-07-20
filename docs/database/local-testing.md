# Pruebas locales de base de datos

Dos maneras de aplicar migraciones desde cero y correr la suite pgTAP
(`supabase/tests/database/`). El resultado debe ser idéntico en ambas.

## Opción A (canónica): Supabase CLI + Docker

Reproduce el entorno real (imagen de Postgres de Supabase con `auth`, roles y pgtap).
Es la que usa CI (`.github/workflows/ci.yml`, job "Migraciones y pruebas RLS").

```bash
pnpm db:start   # inicia Postgres de Supabase (Docker)
pnpm db:reset   # aplica supabase/migrations/ + seed.sql desde cero
pnpm db:test    # ejecuta pgTAP (supabase test db)
pnpm db:types   # regenera packages/types/src/database.types.ts
pnpm db:stop    # detiene los contenedores
```

Tras cualquier cambio de esquema: `pnpm db:reset && pnpm db:test && pnpm db:types` y
commitea el archivo de tipos regenerado en el mismo PR (CLAUDE.md §18). CI falla si el
archivo tiene drift.

## Opción B (sin Docker): PostgreSQL local + shim

Para entornos sin daemon de Docker (algunos sandboxes/VM). Usa un clúster efímero de
PostgreSQL 16 y `scripts/db/supabase-shim.sql`, que emula lo mínimo de Supabase:

- roles `anon`, `authenticated`, `service_role` (con BYPASSRLS),
- esquema `auth` (tabla `users` mínima + `auth.uid()`/`auth.jwt()` leyendo
  `request.jwt.claims`),
- extensiones `pgcrypto` y `pgtap` en el esquema `extensions`,
- privilegios por defecto equivalentes en `public`.

```bash
sudo apt-get install postgresql-16 postgresql-16-pgtap   # una sola vez
pnpm db:test:pg                                          # todo en uno
pnpm db:test:pg -- --keep                                # deja el clúster para inspección
```

El shim **no es una migración** y jamás debe ejecutarse contra un proyecto Supabase.

### Cómo simulan sesión las pruebas

Cada archivo pgTAP crea helpers temporales `pg_temp.login(uuid)` / `pg_temp.logout()`
que fijan `request.jwt.claims` (sub/email/role) y cambian al rol `authenticated` — la
misma mecánica que usa PostgREST. Todo corre dentro de una transacción con `rollback`
final: la base queda limpia y los archivos son independientes entre sí.

### Generar tipos sin Docker

`supabase gen types` requiere Docker. Sin él, se usa el mismo motor vía npm:

```bash
# con el clúster de la opción B corriendo (--keep, puerto 55432)
npm i -D @supabase/postgres-meta   # en un directorio temporal
PG_META_DB_URL=postgresql://postgres@127.0.0.1:55432/postgres PG_META_PORT=18080 \
  node node_modules/@supabase/postgres-meta/dist/server/server.js &
curl -s "http://127.0.0.1:18080/generators/typescript?included_schemas=public" \
  > packages/types/src/database.types.ts
```

Nota: la versión de `@supabase/postgres-meta` puede diferir de la embebida en la CLI y
producir diferencias cosméticas; el job de CI compara contra la CLI y es la referencia.
Si CI reporta drift, regenera con `pnpm db:types` (opción A) y commitea. Sin Docker,
el propio job imprime el archivo canónico como `gzip | base64` entre los marcadores
`___TYPES_CANONICOS_B64_INICIO___`/`___FIN___`: decodifícalo y adóptalo byte a byte
(el archivo está en `.prettierignore` justamente para que nada lo reformatee).

## Dónde viven las cosas

| Qué                | Dónde                                                                     |
| ------------------ | ------------------------------------------------------------------------- |
| Migraciones        | `supabase/migrations/*.sql` (orden lexicográfico, inmutables al fusionar) |
| Pruebas pgTAP      | `supabase/tests/database/*.sql`                                           |
| Shim sin Docker    | `scripts/db/supabase-shim.sql` + `scripts/db/test-local-pg.sh`            |
| Tipos generados    | `packages/types/src/database.types.ts` (versionado, nunca manual)         |
| Seed de desarrollo | `supabase/seed.sql` (vacío en Fase 2; datos SIEMPRE ficticios)            |
