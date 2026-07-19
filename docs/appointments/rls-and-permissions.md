# Agenda — RLS y matriz de permisos

Mismo modelo de fases anteriores: RLS habilitado **y forzado**, privilegios
mínimos por columna, políticas explícitas por operación y escrituras con
invariantes **solo por RPC** (los clientes no tienen `INSERT`/`UPDATE` sobre
citas ni horarios).

## Matriz por rol (clínica activa)

| Operación                                           | clinic_admin* | veterinarian | receptionist | assistant |
| --------------------------------------------------- | ------------- | ------------ | ------------ | --------- |
| Ver catálogo/horarios/citas/historial               | ✅            | ✅           | ✅           | ✅        |
| Configurar catálogo de servicios                    | ✅            | ❌           | ❌           | ❌        |
| Asignar veterinarios a servicios                    | ✅            | ❌           | ❌           | ❌        |
| Configurar horarios semanales                       | ✅            | ❌           | ❌           | ❌        |
| Registrar excepciones                               | ✅ (todas)    | ✅ (propias) | ❌           | ❌        |
| Consultar disponibilidad                            | ✅            | ✅           | ✅           | ✅        |
| Agendar / reagendar / cancelar / no-show / check-in | ✅            | ✅           | ✅           | ❌        |
| Iniciar / completar atención (acto clínico)         | ✅            | ✅           | ❌           | ❌        |
| Ver outbox de notificaciones                        | ✅            | ✅           | ✅           | ❌        |

\* `clinic_admin` incluye a administración de la organización
(`is_clinic_admin` ya considera `is_organization_admin`). El superadmin
conserva SELECT global mediante políticas explícitas (`*_select_superadmin`).

## Aplicación técnica

- **Lectura**: `is_clinic_member(clinic_id)`; tablas hijas de cita usan
  `appointment_clinic_accessible(appointment_id)`.
- **Escritura de agenda**: RPCs DEFINER (`book_appointment`,
  `transition_appointment_status`, `reschedule_appointment`,
  `cancel_appointment`, `configure_veterinarian_schedule`,
  `create_clinic_service`) con validación interna de rol
  (`is_clinic_operational_staff`, `is_clinic_admin`, chequeo de rol
  veterinario para el acto clínico).
- **Escritura directa acotada**: `clinic_services` (columnas de edición, solo
  admin), `clinic_service_veterinarians` (insert/delete admin, trigger de rol),
  `schedule_exceptions` (admin o el propio profesional).
- `appointment_status_history` y `appointment_folio_counters`: sin escritura
  de clientes; el historial es append-only incluso para `service_role`.
- Aislamiento probado en pgTAP (suites 09–10): la organización B no ve ni
  opera catálogo, horarios, citas ni notificaciones de la clínica A.
