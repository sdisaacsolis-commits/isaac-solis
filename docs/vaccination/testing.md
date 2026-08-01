# Vacunación — Estrategia de pruebas

## pgTAP (suite 12, `supabase/tests/database/12_recetas_y_vacunacion.sql`)

- Catálogo: administración lo gestiona; recepción no; invisible para otra organización.
- Aplicación en clínica: solo veterinarios (recepción/suspendidos rechazados); lote
  requerido; lote exige caducidad; producto caducado rechazado; snapshot del producto;
  hora de servidor.
- **Idempotencia**: misma `client_request_id` → mismo registro, sin duplicados.
- Comprobante congelado presente; recordatorio encolado (pendiente) con próxima dosis;
  anulación cancela el recordatorio y conserva lote y contenido.
- Inmutabilidad en dos capas: cliente sin grant (42501) y trigger `VACUNACION_INMUTABLE`
  como postgres.
- Históricos: recepción autorizada; asistente rechazado; fecha futura rechazada; próxima
  dosis solo veterinario; fuente `administered_in_clinic` rechazada en el flujo histórico;
  registro sin veterinario interno marcado por fuente.
- Aislamiento: organización B no ve registros de A (mascota compartida); cada clínica ve
  su propia cartilla; inserts directos rechazados; ids manipulados; historial append-only;
  auditoría **redactada** (el lote jamás aparece en `audit_log`); superadmin explícito.

## Unitarias (Vitest, `packages/validation/src/schemas/vaccinations.test.ts`)

Producto por catálogo o nombre; lote o justificación; lote⇒caducidad; idempotency key
obligatoria; histórico con fuente explícita (rechaza `administered_in_clinic` y fechas mal
formateadas); próxima dosis posterior a la aplicación; catálogo con intervalo como ayuda
editable y rangos; anulación con motivo.

## E2E (Playwright, gate `E2E_AUTH=1`, CI contra Supabase real)

Veterinario registra aplicación (nombre libre, lote, caducidad, próxima dosis) → detalle →
comprobante imprimible → cartilla con distintivo "Aplicada en esta clínica".
Administrador no-veterinario: sin formulario de aplicación, registra histórico aportado →
cartilla con distintivo "Registro histórico aportado". Rutas protegidas sin sesión.

## Integración

`pnpm db:test:pg` (PostgreSQL 16 + shim) y CI `base-de-datos` (Supabase real) ejecutan las
RPCs contra la base real; `e2e-auth` cubre UI → Server Action → RPC → RLS extremo a
extremo.
