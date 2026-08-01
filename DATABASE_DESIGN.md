# Dogtoralia — Diseño de Base de Datos

> Versión 0.1 — Etapa de arquitectura. PostgreSQL 15+ (Supabase). Este documento es el diseño
> lógico; el DDL definitivo vivirá en `supabase/migrations/` cuando inicie el desarrollo.

## 1. Convenciones

- Nombres de tablas y columnas en **inglés, `snake_case`, plural** (`pets`, `appointments`) —
  estándar del ecosistema; la UI traduce a español.
- Llaves primarias `uuid` (`gen_random_uuid()`).
- `created_at timestamptz NOT NULL DEFAULT now()` y `updated_at timestamptz` (trigger) en todas
  las tablas.
- Fechas de calendario (nacimiento, próxima vacuna) como `date`; instantes como `timestamptz`
  (siempre UTC; conversión a `America/Mexico_City` en presentación).
- Enumeraciones como tipos `ENUM` de PostgreSQL.
- **Toda tabla con datos de clínica lleva `clinic_id` y RLS activo.**
- Borrado: `deleted_at` (soft delete) para catálogos; los datos clínicos **no se borran**.

## 2. Diagrama entidad–relación (lógico)

```
auth.users 1──1 profiles
organizations 1──N clinics                    (empresa → clínicas/sucursales)
profiles   1──N organization_members N──1 organizations
profiles   1──N clinic_members N──1 clinics
profiles   1──N pets                          (propietario → mascotas)
clinics    1──N services
clinics    1──N veterinarian_schedules N──1 profiles (veterinario)
clinics    1──N appointments N──1 pets
appointments N──1 services
appointments N──1 profiles (veterinario)
clinics    1──N medical_records N──1 pets     (expediente = relación clínica–mascota)
medical_records 1──N consultations N──1 appointments (opcional)
consultations 1──N diagnoses
consultations 1──N treatments
medical_records 1──N vaccinations
medical_records 1──N dewormings
consultations 1──1 prescriptions 1──N prescription_items
profiles   1──N notifications
clinics    1──N clinic_invitations
clinics    1──1 subscriptions N──1 plans
audit_log  (global, append-only)
```

## 3. Tablas principales

### 3.1 Identidad y tenancy

**`profiles`** — 1:1 con `auth.users`.

| Columna        | Tipo                  | Notas                           |
| -------------- | --------------------- | ------------------------------- |
| id             | uuid PK               | = `auth.users.id`               |
| full_name      | text NOT NULL         |                                 |
| phone          | text                  | formato E.164 (+52...)          |
| avatar_url     | text                  |                                 |
| is_superadmin  | boolean DEFAULT false | solo modificable por superadmin |
| default_locale | text DEFAULT 'es-MX'  |                                 |

**`organizations`** — sujeto comercial (decisión confirmada PRD §7.4). Una empresa o grupo
veterinario que agrupa una o varias clínicas/sucursales.

| Columna                       | Tipo                                                      | Notas                             |
| ----------------------------- | --------------------------------------------------------- | --------------------------------- |
| id                            | uuid PK                                                   |                                   |
| name                          | text NOT NULL                                             | 2–120 caracteres                  |
| legal_name / tax_id           | text                                                      | opcionales; tax_id = RFC (CHECK)  |
| slug                          | text UNIQUE nullable                                      | normalizado; sin slugs reservados |
| status                        | enum `organization_status`: `active, suspended, archived` | gestionado por backend            |
| plan_code                     | text DEFAULT 'beta'                                       | se liga a `plans` en Fase 11      |
| included_active_veterinarians | int DEFAULT 1                                             | límite del plan (PRD §7.4)        |
| created_by                    | uuid FK → profiles                                        |                                   |
| deleted_at                    | timestamptz                                               | borrado lógico                    |

Las organizaciones se crean SOLO con la RPC `create_organization_with_owner` (transacción
organización + primer owner). Sin INSERT directo de clientes.

**`organization_members`** — usuarios asociados a la organización.
`organization_id FK, user_id FK profiles, role enum organization_role: owner, admin,
billing, member`, `status enum membership_status: invited, active, suspended, removed`,
`joined_at, created_by, deleted_at`. Índice único parcial: una sola membresía viva
(no `removed`, no borrada) por usuario y organización. Un trigger garantiza que toda
organización conserve al menos un `owner` activo.

**`clinics`**

| Columna                           | Tipo                                                                            | Notas                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| id                                | uuid PK                                                                         |                                                                                                     |
| organization_id                   | uuid FK → organizations NOT NULL                                                |                                                                                                     |
| name                              | text NOT NULL                                                                   |                                                                                                     |
| slug                              | text UNIQUE nullable                                                            | reservado para perfil público `/clinicas/[slug]` (fase posterior)                                   |
| legal_name / rfc                  | text                                                                            | opcionales                                                                                          |
| address, city, state, postal_code | text                                                                            |                                                                                                     |
| phone, email                      | text                                                                            |                                                                                                     |
| logo_url                          | text                                                                            |                                                                                                     |
| timezone                          | text DEFAULT 'America/Mexico_City'                                              |                                                                                                     |
| status                            | enum `clinic_status`: `trial, active, past_due, suspended, cancelled, archived` | ciclo de vida confirmado (PRD §7.3); toda clínica nace en `trial`; el estado lo gestiona el backend |
| deleted_at                        | timestamptz                                                                     | borrado lógico; **los expedientes nunca se eliminan automáticamente**                               |

Transiciones de `clinic_status` (trigger `clinics_validate_status_transition`, aplica a
todos los roles incluido backend): `trial → active|cancelled`,
`active → past_due|suspended|cancelled`, `past_due → active|suspended|cancelled`,
`suspended → active|cancelled`, `cancelled → active|archived`; `archived` es terminal.
En `suspended` y `cancelled` el acceso se restringe según políticas futuras; los datos
clínicos se conservan (plazo de retención definitivo pendiente de revisión legal).
El campo `status` no es modificable por clientes (sin GRANT de columna).

**`clinic_members`** — corazón de la autorización por clínica.

| Columna                         | Tipo                                                                      | Notas                                                  |
| ------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------ |
| id                              | uuid PK                                                                   |                                                        |
| clinic_id                       | uuid FK → clinics                                                         |                                                        |
| user_id                         | uuid FK → profiles                                                        |                                                        |
| role                            | enum `clinic_role`: `clinic_admin, veterinarian, receptionist, assistant` |                                                        |
| status                          | enum `membership_status`: `invited, active, suspended, removed`           | solo `active` da acceso                                |
| professional_license            | text                                                                      | cédula; se exigirá a veterinarios al activar la agenda |
| job_title                       | text                                                                      |                                                        |
| joined_at/created_by/deleted_at | —                                                                         | índice único parcial: una membresía viva por usuario   |

Trigger `clinic_members_require_org_membership`: solo miembros ACTIVOS de la organización
dueña pueden tener membresía viva en la clínica. (Los datos profesionales extendidos —
especialidad, biografía — se agregarán con los perfiles públicos.)

**`clinic_invitations`**
`clinic_id, email (normalizado a minúsculas), role clinic_role, token_hash (SHA-256, ÚNICO
dato persistido del token; columna sin GRANT de lectura para clientes), status enum
invitation_status: pending, accepted, expired, revoked, expires_at, accepted_at,
accepted_by, invited_by`. Índice único parcial: sin invitaciones `pending` duplicadas por
(clínica, correo, rol). Creación solo vía RPC `invite_clinic_member`; aceptación vía
`accept_clinic_invitation`; los clientes solo pueden revocar.

### 3.2 Mascotas

**`pets`**

| Columna                     | Tipo                                           | Notas                        |
| --------------------------- | ---------------------------------------------- | ---------------------------- |
| id                          | uuid PK                                        |                              |
| owner_id                    | uuid FK → profiles NOT NULL                    |                              |
| name                        | text NOT NULL                                  |                              |
| species                     | enum: `dog, cat, bird, rabbit, reptile, other` |                              |
| breed                       | text                                           |                              |
| sex                         | enum: `male, female, unknown`                  |                              |
| birth_date                  | date                                           | o `estimated_age_months int` |
| weight_kg                   | numeric(5,2)                                   | último peso conocido         |
| color, distinguishing_marks | text                                           |                              |
| microchip_number            | text UNIQUE NULLS DISTINCT                     |                              |
| photo_url                   | text                                           |                              |
| is_deceased                 | boolean DEFAULT false                          |                              |

### 3.3 Servicios y agenda

**`services`** — catálogo por clínica.
`clinic_id, name, description, duration_minutes int NOT NULL, price_cents int NOT NULL, currency char(3) DEFAULT 'MXN', is_active`.
(Precios en centavos para evitar errores de punto flotante.)

**`veterinarian_schedules`** — disponibilidad recurrente.
`clinic_id, veterinarian_id (FK profiles), weekday smallint (0–6), start_time time, end_time time, slot_minutes int`.
**[Propuesta]** `schedule_exceptions` para vacaciones/días festivos.

**`appointments`**

| Columna             | Tipo                                                                     | Notas                                   |
| ------------------- | ------------------------------------------------------------------------ | --------------------------------------- |
| id                  | uuid PK                                                                  |                                         |
| clinic_id           | uuid FK NOT NULL                                                         |                                         |
| pet_id              | uuid FK → pets NOT NULL                                                  |                                         |
| veterinarian_id     | uuid FK → profiles NOT NULL                                              |                                         |
| service_id          | uuid FK → services                                                       |                                         |
| starts_at / ends_at | timestamptz NOT NULL                                                     |                                         |
| status              | enum: `requested, confirmed, in_progress, completed, cancelled, no_show` |                                         |
| requested_by        | uuid FK → profiles                                                       | quién la creó (recepción o propietario) |
| cancellation_reason | text                                                                     |                                         |
| rescheduled_from_id | uuid FK → appointments                                                   | cadena de reprogramaciones              |
| notes               | text                                                                     |                                         |

Restricción anti-traslape (misma clínica y veterinario, citas activas):

```sql
CONSTRAINT no_overlap EXCLUDE USING gist (
  veterinarian_id WITH =,
  tstzrange(starts_at, ends_at) WITH &&
) WHERE (status IN ('requested','confirmed','in_progress'))
```

La transición de estados se hace vía función SQL `update_appointment_status(...)` que valida el
grafo permitido: `requested → confirmed → in_progress → completed`; salidas a `cancelled`
(desde requested/confirmed) y `no_show` (desde confirmed).

### 3.4 Expediente clínico

**`medical_records`** — un expediente por (clínica, mascota).
`clinic_id, pet_id, record_number (secuencial por clínica), allergies text, chronic_conditions text, UNIQUE (clinic_id, pet_id)`.

**`consultations`** — nota de consulta.

| Columna                                                | Tipo                 | Notas                                                  |
| ------------------------------------------------------ | -------------------- | ------------------------------------------------------ |
| id, medical_record_id FK, appointment_id FK nullable   |                      | consulta puede existir sin cita (walk-in)              |
| veterinarian_id                                        | uuid FK NOT NULL     | quién atendió                                          |
| reason, anamnesis, physical_exam_notes                 | text                 |                                                        |
| weight_kg, temperature_c, heart_rate, respiratory_rate | numeric              | signos vitales                                         |
| status                                                 | enum: `open, closed` | al cerrar se vuelve inmutable; correcciones por adenda |
| closed_at                                              | timestamptz          |                                                        |

**`consultation_addenda`** — correcciones post-cierre: `consultation_id, author_id, content, created_at`.

**`diagnoses`** — `consultation_id, description text NOT NULL, notes`.
**`treatments`** — `consultation_id, description, instructions, start_date, end_date`.

**`vaccinations`**
`medical_record_id, consultation_id nullable, vaccine_name, batch_number, applied_on date, next_due_on date, applied_by (FK profiles), notes`.

**`dewormings`**
`medical_record_id, consultation_id nullable, product_name, dose, applied_on date, next_due_on date, applied_by, notes`.

**`record_attachments`** — `medical_record_id, consultation_id nullable, storage_path, file_name, mime_type, uploaded_by`.
(Archivo real en bucket privado `medical-files`; acceso por URL firmada.)

### 3.5 Recetas

**`prescriptions`**
`consultation_id UNIQUE, clinic_id, veterinarian_id, issued_at timestamptz, pdf_storage_path, status enum: draft, issued`.
Al pasar a `issued` la receta y sus partidas quedan inmutables (trigger).
El PDF incluye nombre y cédula del veterinario y datos de la clínica.
**Restricción de alcance:** sin medicamentos controlados en el MVP.

**`prescription_items`**
`prescription_id, medication_name, presentation, dose, route, frequency, duration, instructions`.

### 3.6 Notificaciones y recordatorios

**`notifications`** — cola con estado (no "disparar y olvidar").

| Columna                                          | Tipo                                                                                                                                | Notas                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| id, recipient_id FK profiles, clinic_id nullable |                                                                                                                                     |                        |
| type                                             | enum: `appointment_reminder, appointment_confirmed, appointment_cancelled, appointment_rescheduled, vaccination_due, deworming_due` |                        |
| channel                                          | enum: `push, email`                                                                                                                 | una fila por canal     |
| payload                                          | jsonb                                                                                                                               | datos para plantilla   |
| scheduled_for                                    | timestamptz                                                                                                                         | cuándo debe enviarse   |
| status                                           | enum: `pending, sent, failed, cancelled`                                                                                            |                        |
| attempts                                         | int DEFAULT 0                                                                                                                       | reintentos con backoff |
| sent_at, last_error                              |                                                                                                                                     |                        |

**`device_tokens`** — `user_id, fcm_token UNIQUE, platform enum: ios, android, updated_at`.

`pg_cron` (cada 15 min) encola recordatorios de vacunas/desparasitaciones próximas y dispara la
Edge Function `send-reminders` para procesar `notifications` pendientes.

### 3.7 Suscripciones (preparación, sin cobro en MVP)

Modelo comercial confirmado (PRD §7.4): **suscripción por clínica** con una cantidad incluida
de veterinarios activos y cobro futuro por veterinarios adicionales; las organizaciones
permiten planes de grupo multi-sucursal en el futuro.

**`plans`**
`code UNIQUE, name, price_cents, currency 'MXN', billing_interval enum: month, year,`
`included_veterinarians int NOT NULL, additional_veterinarian_price_cents int nullable,`
`scope enum plan_scope: clinic, organization (para planes de grupo futuros), features jsonb, is_active`.

**`subscriptions`**
`clinic_id UNIQUE, organization_id (denormalizado para reporteo/facturación de grupo),`
`plan_id, status enum: trialing, active, past_due, canceled,`
`current_period_start/end, stripe_customer_id nullable, stripe_subscription_id nullable`.
En el MVP toda clínica activa recibe una suscripción al plan `beta` sin Stripe. El límite de
veterinarios activos por plan se verifica con una función SQL al activar miembros con rol
`veterinarian` (en el plan `beta` el límite no bloquea, solo se registra).

### 3.8 Auditoría

**`audit_log`** — append-only (sin políticas de UPDATE/DELETE; revocados a todos los roles).
`id bigint identity, occurred_at, actor_id nullable, clinic_id nullable, table_name, record_id, action enum: insert, update, delete, old_data jsonb, new_data jsonb`.
Poblada por triggers en: `organizations, organization_members, clinic_members, appointments, consultations, consultation_addenda, prescriptions, vaccinations, dewormings, medical_records, subscriptions, clinics, profiles(is_superadmin)`.

## 4. Estrategia multi-tenant

- Tenant = **clínica**. Discriminador: columna `clinic_id` en toda tabla de datos de clínica.
- Tablas hijas del expediente (`consultations`, `diagnoses`, ...) heredan el tenant vía su padre;
  las políticas RLS resuelven `clinic_id` con un `JOIN` o función auxiliar.
- Los propietarios y mascotas son **globales** (no pertenecen a una clínica): la relación
  clínica–mascota nace con la primera cita o expediente. Una clínica solo ve mascotas con las
  que tiene relación (cita o expediente existente) o que registra recepción.
- **RLS obligatorio**: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `FORCE`; ninguna tabla de
  datos queda expuesta sin políticas. CI incluye una prueba que falla si existe alguna tabla
  del esquema `public` sin RLS.

Funciones auxiliares (SECURITY DEFINER, STABLE):

```sql
is_superadmin() → boolean
is_clinic_member(p_clinic_id uuid, p_roles clinic_role[] DEFAULT NULL) → boolean
owns_pet(p_pet_id uuid) → boolean
```

## 5. Matriz de acceso por rol (resumen)

| Recurso                   | Superadmin | Admin clínica                       | Veterinario      | Recepcionista                           | Propietario                    |
| ------------------------- | ---------- | ----------------------------------- | ---------------- | --------------------------------------- | ------------------------------ |
| Clínicas (todas)          | CRUD       | —                                   | —                | —                                       | —                              |
| Su clínica (config)       | R          | RU                                  | R                | R                                       | —                              |
| Personal (clinic_members) | R          | CRUD                                | R                | R                                       | —                              |
| Servicios y horarios      | R          | CRUD                                | R (los suyos)    | R                                       | R (catálogo de su clínica)     |
| Mascotas                  | —          | R (relacionadas)                    | R (relacionadas) | CRU (relacionadas)                      | CRUD (las suyas)               |
| Citas                     | —          | CRUD                                | RU (las suyas)   | CRUD                                    | CR (las suyas: crear/cancelar) |
| Expedientes y consultas   | —          | R                                   | CRUD             | — (solo existencia, sin detalle médico) | R (sus mascotas)               |
| Recetas                   | —          | R                                   | CRUD (emite)     | —                                       | R (sus mascotas)               |
| Notificaciones            | —          | R (de su clínica)                   | R (las suyas)    | R (de su clínica)                       | R (las suyas)                  |
| Suscripción de clínica    | CRUD       | R                                   | —                | —                                       | —                              |
| audit_log                 | R          | R (solo su clínica) **[Propuesta]** | —                | —                                       | —                              |

Notas:

- "Relacionadas" = mascotas con cita o expediente en la clínica.
- El detalle médico (consultas, diagnósticos, tratamientos, recetas) está **excluido** de
  recepción por política RLS, no solo por UI.
- El superadmin **no** tiene acceso por defecto a expedientes; el soporte con acceso se
  implementaría como elevación temporal auditada **[Propuesta]**.

## 6. Integridad y validación en BD

- `CHECK (ends_at > starts_at)` en citas; `CHECK (price_cents >= 0)`; `CHECK` de rangos en
  signos vitales.
- FK con `ON DELETE RESTRICT` por defecto (los datos clínicos no se borran en cascada).
- Triggers: `updated_at`, inmutabilidad de recetas emitidas y consultas cerradas, auditoría.
- Índices: `(clinic_id, starts_at)` en citas; `(owner_id)` en pets; `(status, scheduled_for)`
  en notifications; `(next_due_on)` en vaccinations/dewormings; índice GiST del anti-traslape.

## 7. Ciclo de vida de datos y privacidad

- Baja de propietario (derecho de supresión): se anonimiza el perfil (`full_name`, `phone`,
  correo) pero el expediente clínico se conserva ligado a la mascota — obligación de la clínica.
- Baja de clínica: datos en modo solo-lectura por periodo de retención definido (pendiente
  de definición legal, ver ARCHITECTURE.md §10).
- Exportación de datos del propietario (ARCO): función que compila sus datos y expedientes
  de sus mascotas en JSON/PDF **[Propuesta de implementación en fase de app móvil]**.

## 8. Estado de implementación

| Fase                | Qué está implementado                                                                                                                                                                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fase 2 (2026-07-19) | `profiles`, `reserved_slugs`, `organizations`, `organization_members`, `clinics`, `clinic_members`, `clinic_invitations`, `audit_log`; 6 enums; 8 funciones auxiliares de seguridad; 3 RPCs transaccionales; RLS habilitado y forzado con políticas por operación; 153 aserciones pgTAP. Migraciones `202607191000*`. |

Decisiones aplicadas en la Fase 2:

- **Enums de PostgreSQL** para vocabularios cerrados (roles, estados) — tipado fuerte y
  tipos TS generados; **tabla** (`reserved_slugs`) para catálogos extensibles sin
  migración. Criterio documentado en la migración `..._enums_y_slugs.sql`.
- **Slug de clínica único GLOBALMENTE** (no por organización): la ruta pública futura
  `/clinicas/[slug]` no incluye organización; unicidad global evita renombres al publicar.
- **`audit_log` con id `bigint identity`** (no uuid): tabla de log de alto volumen con
  orden natural; el resto de tablas de negocio usa uuid.
- Los detalles operativos del modelo de seguridad viven en `docs/security/rls-model.md` y
  `docs/security/roles-and-permissions.md`; las guías de prueba en
  `docs/database/local-testing.md`.

| Fase 3 (2026-07-19) | Vista segura `colleague_profiles` (datos básicos de colegas por organización compartida; migración 0011) y RPCs `create_clinic_with_admin` + `resend_clinic_invitation` (migración 0012). 171 aserciones pgTAP totales. |

| Fase 4 (2026-07-19) | Dominio de pacientes: `pet_owners`, `pets`, `pet_owner_relationships` (principal único), `clinic_pet_relationships` (datos privados por clínica), `owner_clinic_relationships`, `pet_alerts`, `owner_consents` (versionados); 11 enums; 8 funciones de acceso; 5 RPCs; bucket privado `pet-photos` con políticas de Storage; 70 aserciones pgTAP nuevas (241 totales). Migraciones `202607193000*`. **Nota**: este diseño SUSTITUYE al esbozo original de `pets` de §3.2 (que llevaba `owner_id` directo); el modelo definitivo separa identidad global de relaciones — ver `docs/pets/domain-model.md`. |
| Fase 5 (2026-07-19) | Agenda: `clinic_services` + `clinic_service_veterinarians`, `veterinarian_schedules` (EXCLUDE de ventanas) + `schedule_exceptions`, `appointments` (folio `CIT-AAAA-NNNNNN` por contador UPSERT; `EXCLUDE USING gist` anti-traslape sobre la ventana ocupada con colchones, solo estados que ocupan agenda), `appointment_services` (snapshot), `appointment_status_history` (append-only por trigger), `appointment_folio_counters`, `appointment_notifications` (outbox idempotente); 7 enums; máquina de estados en SQL; RPCs `create_clinic_service`, `configure_veterinarian_schedule`, `book_appointment`, `transition_appointment_status`, `reschedule_appointment`, `cancel_appointment`, `get_available_slots`, claim/mark del outbox; 70 aserciones pgTAP nuevas (311 totales). Migraciones `202607194000*`. Ver `docs/appointments/`. |
| Fase 6 (2026-07-20) | Expediente clínico: `clinical_encounters` (folio `CON-AAAA-NNNNNN` por contador UPSERT; cita ≠ consulta; `draft` fusionado con `in_progress`; una consulta no anulada por cita vía índice único parcial), `clinical_notes` + `encounter_examinations` (1:1 **versionadas**, trigger `bump_version` para control optimista), `clinical_vitals` (append-only), `diagnoses` (principal único por índice parcial, soft-delete), `encounter_treatments`, `encounter_follow_ups`, `clinical_files` (metadata; bucket privado `clinical-files` con políticas de Storage por ruta), `encounter_addenda` (append-only, solo finalizadas), `encounter_status_history` (trigger), `clinical_folio_counters`; 6 enums; funciones `can_view_clinical_content`/`can_edit_clinical_encounter`/`can_record_vitals`/`can_finalize_clinical_encounter`; RPCs `start_encounter_from_appointment` (idempotente), `create_walk_in_encounter` (cita interna), `finalize_clinical_encounter` (requisitos mínimos), `void_clinical_encounter` (solo administración de la organización), `log_clinical_record_access` (impresión/descarga); inmutabilidad de dos capas (RLS + `CONSULTA_INMUTABLE`) y auditoría redactada (sin contenido clínico en `audit_log`); 54 aserciones pgTAP nuevas (suite 11; 365 totales). Migraciones `202607195000*`. Ver `docs/clinical/`. |
| Fase 7 (2026-07-20) | Recetas y vacunación: `prescriptions` (folio `REC-AAAA-NNNNNN` por contador UPSERT; estados `draft→issued→superseded\|voided`; snapshots jsonb de servidor con cédula profesional; sustituto único vivo por índice parcial), `prescription_items` (texto clínico del veterinario, orden por `position`), `prescription_status_history` (append-only), `prescription_documents` (contenido canónico congelado + SHA-256 calculado en la base; trigger sin update/delete), `prescription_folio_counters`; `vaccines_catalog` (por organización, no prescriptivo), `vaccination_records` (inmutables; fuentes en clínica/históricas; lote+caducidad validados; idempotencia por `client_request_id`), `vaccination_status_history`, `vaccination_documents` (comprobante congelado), `vaccination_notifications` (outbox de recordatorios); 4 enums; helpers `can_view_prescription`/`can_edit_prescription`/`can_view_vaccination_record`/`can_manage_vaccine_catalog`; RPCs `create_prescription_draft`, `issue_prescription` (idempotente, `FOR UPDATE`), `supersede_prescription`, `void_prescription`, `discard_prescription_draft`, `log_prescription_access`, `record_vaccination`, `record_historical_vaccination`, `void_vaccination_record`, `log_vaccination_access`, claim/mark del outbox de vacunación; bucket privado `vaccination-files`; inmutabilidad de dos capas (`RECETA_INMUTABLE`/`VACUNACION_INMUTABLE`/`DOCUMENTO_INMUTABLE`) y auditoría redactada (sin medicamentos ni lotes en `audit_log`); 76 aserciones pgTAP nuevas (suite 12; 441 totales). Migraciones `202607206000*`. Ver `docs/prescriptions/` y `docs/vaccination/`. |
| Fase 8 (2026-07-21) | Portal público: `veterinarian_public_profiles` (opt-in, slug global, solo vets activos), `portal_invitations` (token SHA-256 ilegible, 7 días, un uso), `public_booking_requests` (idempotencia + rastro); RPCs públicas curadas para anon (`search_public_clinics`, `get_public_clinic`, `get_public_veterinarian`, `list_public_cities`, `get_public_available_slots`, `request_public_appointment` con cita `requested`/`owner_portal` que no ocupa agenda y límite 5/correo/24 h) y del portal (`create/accept_portal_invitation`, `get_my_pets/appointments/pet_history` curados, `cancel_my_appointment`); `get_available_slots` re-emitida con bypass GUC `app.portal_public_slots` solo para clínicas públicamente reservables; anon sin grants sobre tablas base (probado). 33 aserciones pgTAP nuevas (suite 13; 474 totales). Migraciones `202607217000*`. Ver `docs/portal/`. |
| Fase 10 (2026-07-29) | Panel administrativo y métricas (sin tablas nuevas; agregación por RPC SECURITY DEFINER): `clinic_appointment_metrics(clinic, from, to)` → jsonb con conteos por estado, completadas/canceladas/inasistencias, hoy y por-confirmar (bucketing en la zona de la clínica; solo personal operativo). Panel superadmin reutilizando `profiles.is_superadmin`/`current_user_is_superadmin()`: `platform_overview()` (panorama global), `platform_clinics(limit, offset)` (listado con organización y actividad), `platform_recent_activity(limit)` (audit_log global) — todas superadmin-only. 16 aserciones pgTAP nuevas (suite 16; 543 totales) con dataset conocido y aislamiento entre clínicas. Migración `20260723000001`. Ver ADR/`docs/admin/`. |
| Fase 11 (2026-07-29) | Preparación de suscripciones: `plans` (catálogo por clínica/organización; lectura pública de activos; `included_veterinarians`, `price_cents` en centavos MXN, `features` jsonb) y `subscriptions` (una por clínica; RLS forzado: personal operativo / org-admin / superadmin leen, sin escritura de cliente; identificadores `stripe_customer_id`/`stripe_subscription_id` nullable) con RLS de aislamiento por clínica. Enums `plan_scope` (`clinic`/`organization`), `billing_interval` (`month`/`year`), `subscription_status` (`trialing`/`active`/`past_due`/`canceled`). Plan `beta` gratuito sembrado y **alta automática de la suscripción por trigger** al crear la clínica (toda clínica tiene plan). Restricción por plan disponible pero no bloqueante en beta: `clinic_current_plan(clinic)` → jsonb (plan vigente, solo personal operativo), `clinic_active_veterinarian_count(clinic)`, `clinic_within_veterinarian_limit(clinic)` (SECURITY DEFINER, grant a `authenticated`). Scaffold de Stripe (`stripe-webhook`) sin cobros. 13 aserciones pgTAP nuevas (suite 17; 556 totales) con aislamiento entre clínicas. Migración `20260723100001`. Ver ADR 0004 y `docs/subscriptions/subscriptions.md`. |
| Fase 9 (2026-07-29) | Recordatorios automáticos (backend programado): `device_tokens` (registro de tokens push FCM por usuario, RLS por dueño, `unique(token)`) + RPCs `register_device_token`/`unregister_device_token`; enum `device_platform` (`ios`/`android`/`web`); RPCs batch cross-clínica reservadas a `service_role` `claim_due_appointment_notifications_batch`/`mark_appointment_notification_by_service` (+ equivalentes de vacunación) que reclaman las notificaciones vencidas de TODAS las clínicas con `FOR UPDATE SKIP LOCKED` y reintentos limitados (≤5, terminal `failed`); idempotencia por `idempotency_key UNIQUE` de los outbox existentes. Edge Function `send-reminders` (Deno) los consume; programación (cron) documentada para la nube. 22 aserciones pgTAP nuevas (suite 15; 527 totales). Migración `20260722900001`. Ver ADR 0003 y `docs/notifications/reminders.md`. **[Propuesta]** de seguimiento: envío push a propietarios y desparasitaciones (`dewormings`). |
| Fase 8.1 (2026-07-28) | Reseñas verificadas: `reviews` (una por cita completada del propietario que asistió, verificación estructural por trigger; estados published/hidden con contenido conservado; respuesta de clínica; campos de moderación), `review_moderation_events` (append-only); `review_status` enum; helper `clinic_rating`; RPCs `submit_review`, `update_my_review` (ventana 30 días), `reply_to_review`, `report_review`, `set_review_visibility` (moderación elevada), `get_my_reviewable_appointments`, `get_clinic_reviews` (público curado, autor enmascarado), y re-emisión de `search_public_clinics`/`get_public_clinic` con promedio de calificación; RLS forzado, anon sin grants. 31 aserciones pgTAP nuevas (suite 14; 505 totales). Migraciones `202607228000*`. Ver `docs/portal/reviews.md`. |
