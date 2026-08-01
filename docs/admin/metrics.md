# Panel administrativo y métricas (Fase 10)

Métricas de clínica y panel superadmin. Toda la agregación vive en RPCs SECURITY DEFINER —
la **autorización se decide en la base** (CLAUDE.md §4); la UI solo oculta lo que el rol no
debe ver. Sin tablas nuevas: se agregan las entidades existentes.

## Métricas de clínica

`clinic_appointment_metrics(p_clinic_id uuid, p_from date, p_to date) → jsonb`

- Solo **personal operativo** de esa clínica (`is_clinic_operational_staff`); si no, `42501`.
- Bucketing por fecha en la **zona horaria de la clínica** (`scheduled_start` es `timestamptz`
  en UTC; se convierte con `at time zone`).
- Devuelve: `total_periodo`, `por_estado` (los 8 estados), `completadas`, `canceladas`,
  `no_show` (inasistencias) dentro del rango; y de estado actual `hoy` y `por_confirmar`
  (`requested` + `pending_confirmation`).
- El dashboard `/app/inicio` la usa para el mes en curso; las citas por confirmar se listan
  con el flujo de solicitudes en línea existente.

## Panel superadmin (`/app/admin`)

Superadmin = `profiles.is_superadmin` (booleano protegido por trigger + auditoría) +
`current_user_is_superadmin()`. La UI se protege con `requireSuperadmin()` (`notFound()` si
no lo es) y la entrada de menú solo aparece para superadmins; las RPCs además lo verifican.

| RPC                               | Devuelve                                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `platform_overview()`             | Panorama global: organizaciones/clínicas por estado, veterinarios activos, propietarios, mascotas, citas. |
| `platform_clinics(limit, offset)` | Listado de clínicas con su organización, estado, público y nº de citas.                                   |
| `platform_recent_activity(limit)` | Actividad reciente del `audit_log` (global).                                                              |

Todas lanzan `42501` para no-superadmin.

## Pruebas

`supabase/tests/database/16_metricas_admin.sql` (16 aserciones): métricas correctas contra un
**dataset conocido** (citas insertadas en estados y fechas controlados), aislamiento entre
clínicas (las citas de B no cuentan en A), permiso de personal para métricas de clínica y de
superadmin para las de plataforma (no-autorizados denegados).
