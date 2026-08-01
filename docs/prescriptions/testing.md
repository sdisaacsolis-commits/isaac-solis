# Recetas — Estrategia de pruebas

## pgTAP (suite 12, `supabase/tests/database/12_recetas_y_vacunacion.sql`)

Cobertura de recetas (junto con vacunación, 76 aserciones; 441 totales):

- Estructura: RLS habilitado **y forzado** en las 10 tablas nuevas.
- Borrador por veterinario durante consulta abierta; recepción/suspendidos rechazados.
- Emisión: exige consulta finalizada; folio `REC-AAAA-000001`; idempotente (mismo folio,
  un solo documento); snapshots de servidor con cédula; hash verificado contra el
  contenido canónico.
- Inmutabilidad en dos capas: cliente 0-filas / 42501; trigger `RECETA_INMUTABLE` como
  postgres; partidas bloqueadas tras emitir.
- Visibilidad por rol: recepción no ve borradores pero sí emitidas; asistente ve
  borradores pero no emite; organización B no ve nada (mascota compartida).
- Sustitución: motivo obligatorio, partidas copiadas, original intacto hasta emitir el
  sustituto, folio nuevo, un solo sustituto en curso.
- Anulación: permiso elevado + motivo; contenido íntegro.
- Historial append-only; contadores de folio inaccesibles; auditoría **redactada** (sin
  nombres de medicamentos en `audit_log`); superadmin explícito; ids manipulados.

## Unitarias (Vitest, `packages/validation/src/schemas/prescriptions.test.ts`)

Partida completa; medicamento sin nombre; dosis/frecuencia/duración vacías; longitudes;
fechas incoherentes; posiciones fuera de rango; emisión con confirmación explícita;
sustitución/anulación sin motivo; ids manipulados; versión optimista.

## E2E (Playwright, `apps/web/e2e/recetas-vacunacion-flujos.spec.ts`, gate `E2E_AUTH=1`)

Flujo real contra Supabase local en CI: crear borrador desde consulta finalizada → dos
medicamentos → emitir con confirmación → edición bloqueada → documento imprimible con folio
y hash → sustituir → emitir sustituto → original marcado "Sustituida". Rutas protegidas sin
sesión en `auth-rutas.spec.ts`.

## Integración

Las RPCs se prueban contra PostgreSQL real dos veces: `pnpm db:test:pg` (PostgreSQL 16 +
shim, sin Docker) y el job de CI `base-de-datos` (imagen real de Supabase). El flujo E2E
del CI (`e2e-auth`) ejerce la ruta completa UI → Server Action → RPC → RLS.
