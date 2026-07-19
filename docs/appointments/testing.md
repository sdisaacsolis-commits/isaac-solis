# Agenda — Estrategia de pruebas

## pgTAP (autoridad: seguridad e invariantes)

- **Suite 09** (`09_agenda_servicios_horarios.sql`): catálogo (permisos,
  duplicados, asignación de veterinarios), horarios (reemplazo transaccional,
  EXCLUDE de ventanas, solo veterinarios), excepciones (propias vs. ajenas,
  cierres, special_hours) y disponibilidad (conteo exacto de slots, recorte
  por excepciones, límite de 31 días, aislamiento).
- **Suite 10** (`10_citas_flujo.sql`): folio secuencial, snapshot de precios,
  anti-traslape (incluye colchones y liberación al cancelar), horario laboral,
  urgencias y walk-in, aislamiento entre organizaciones, máquina de estados
  completa (roles incluidos), efectos de completar (`last_visit_at`),
  cancelación con motivo, reagendamiento (identidad y folio conservados),
  outbox (encolado, idempotencia por horario, cancelación de recordatorios) y
  superficie mínima (sin DML directo, historial append-only, contadores
  inaccesibles).
- Corren con `pnpm db:test` (Supabase CLI) y `pnpm db:test:pg` (sin Docker).

### Concurrencia del anti-traslape

pgTAP corre en una sola sesión, así que la carrera real de dos reservas
simultáneas no puede simularse ahí. La garantía es estructural: el `EXCLUDE
USING gist` serializa cualquier par de transacciones que intenten ocupar
rangos cruzados del mismo profesional (una recibe `23P01`), y la suite 10
verifica que la violación se produce y se traduce (`HORARIO_OCUPADO`). El
folio usa UPSERT sobre el contador, serializado por bloqueo de fila.

## Unitarias (Vitest)

- Esquemas Zod de agenda (`appointments.test.ts`): horas, precios en pesos →
  centavos, urgencias, rangos de disponibilidad, folio.
- Utilidades de zona horaria (`dates.test.ts`): conversión local↔UTC con DST,
  día local, formato MXN.

## E2E (Playwright)

- **Siempre**: rutas de agenda protegidas sin sesión (`auth-rutas.spec.ts`).
- **Con Supabase local** (`E2E_AUTH=1` + `SUPABASE_SERVICE_ROLE_KEY` local,
  `agenda-flujos.spec.ts`): cuenta→servicio→horario→disponibilidad→cita→
  check-in→atención→completada, y cancelación con motivo. El fixture del
  veterinario se crea con la service role **local** (permitida en CI por
  CLAUDE.md §2) porque aún no existe UI de cambio de rol.
