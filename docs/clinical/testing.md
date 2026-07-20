# Pruebas del expediente clínico

## pgTAP (autoridad: la base de datos)

Suite `supabase/tests/database/11_expediente_clinico.sql` (54 aserciones; 365 totales):
apertura desde cita e idempotencia, walk-in con cita interna, folio `CON-` por contador,
requisitos de finalización (motivo, A+P, exploración/vitales u omisión justificada),
inmutabilidad de dos capas (RLS 0-filas + `CONSULTA_INMUTABLE`), adendas solo en
finalizadas, anulación solo administración de la organización, control de versión de la
nota, privacidad por rol (recepción sin contenido; asistente con vitales) y aislamiento
entre clínicas. Ejecutar con `pnpm db:test` (Supabase CLI) o `pnpm db:test:pg`
(PostgreSQL 16 + shim, sin Docker).

## Unitarias (Vitest)

Esquemas Zod de `packages/validation/src/schemas/clinical.test.ts` (rangos de vitales,
adenda/anulación con motivo, tipos de archivo) — corren con `pnpm test` desde la raíz.

## E2E (Playwright, gated)

`apps/web/e2e/expediente-flujos.spec.ts` corre solo con `E2E_AUTH=1` +
`SUPABASE_SERVICE_ROLE_KEY` del Supabase LOCAL (fixture de veterinario; la captura
clínica exige rol veterinario por RLS): walk-in → vitales → exploración → SOAP →
diagnóstico → tratamiento → finalizar → adenda → documento imprimible → expediente de la
mascota. Las suites básicas (`auth-rutas` incluye `/app/consultas*`) corren sin Supabase.
