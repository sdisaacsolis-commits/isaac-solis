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
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | = `auth.users.id` |
| full_name | text NOT NULL | |
| phone | text | formato E.164 (+52...) |
| avatar_url | text | |
| is_superadmin | boolean DEFAULT false | solo modificable por superadmin |
| default_locale | text DEFAULT 'es-MX' | |

**`clinics`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| legal_name / rfc | text | opcionales |
| address, city, state, postal_code | text | |
| phone, email | text | |
| logo_url | text | |
| timezone | text DEFAULT 'America/Mexico_City' | |
| status | enum: `pending, active, suspended` | activada por superadmin |

**`clinic_members`** — corazón de la autorización por clínica.
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| clinic_id | uuid FK → clinics | |
| user_id | uuid FK → profiles | |
| role | enum `clinic_role`: `clinic_admin, veterinarian, receptionist` | |
| license_number | text | cédula profesional (obligatoria si role = veterinarian) |
| specialty, bio | text | datos profesionales del veterinario |
| is_active | boolean DEFAULT true | baja lógica del personal |
| UNIQUE (clinic_id, user_id) | | un rol por usuario por clínica |

**`clinic_invitations`**
Invitaciones de personal: `clinic_id, email, role, token_hash, expires_at, accepted_at, invited_by`.

### 3.2 Mascotas

**`pets`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid FK → profiles NOT NULL | |
| name | text NOT NULL | |
| species | enum: `dog, cat, bird, rabbit, reptile, other` | |
| breed | text | |
| sex | enum: `male, female, unknown` | |
| birth_date | date | o `estimated_age_months int` |
| weight_kg | numeric(5,2) | último peso conocido |
| color, distinguishing_marks | text | |
| microchip_number | text UNIQUE NULLS DISTINCT | |
| photo_url | text | |
| is_deceased | boolean DEFAULT false | |

### 3.3 Servicios y agenda

**`services`** — catálogo por clínica.
`clinic_id, name, description, duration_minutes int NOT NULL, price_cents int NOT NULL, currency char(3) DEFAULT 'MXN', is_active`.
(Precios en centavos para evitar errores de punto flotante.)

**`veterinarian_schedules`** — disponibilidad recurrente.
`clinic_id, veterinarian_id (FK profiles), weekday smallint (0–6), start_time time, end_time time, slot_minutes int`.
**[Propuesta]** `schedule_exceptions` para vacaciones/días festivos.

**`appointments`**
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| clinic_id | uuid FK NOT NULL | |
| pet_id | uuid FK → pets NOT NULL | |
| veterinarian_id | uuid FK → profiles NOT NULL | |
| service_id | uuid FK → services | |
| starts_at / ends_at | timestamptz NOT NULL | |
| status | enum: `requested, confirmed, in_progress, completed, cancelled, no_show` | |
| requested_by | uuid FK → profiles | quién la creó (recepción o propietario) |
| cancellation_reason | text | |
| rescheduled_from_id | uuid FK → appointments | cadena de reprogramaciones |
| notes | text | |

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
| Columna | Tipo | Notas |
|---|---|---|
| id, medical_record_id FK, appointment_id FK nullable | | consulta puede existir sin cita (walk-in) |
| veterinarian_id | uuid FK NOT NULL | quién atendió |
| reason, anamnesis, physical_exam_notes | text | |
| weight_kg, temperature_c, heart_rate, respiratory_rate | numeric | signos vitales |
| status | enum: `open, closed` | al cerrar se vuelve inmutable; correcciones por adenda |
| closed_at | timestamptz | |

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
| Columna | Tipo | Notas |
|---|---|---|
| id, recipient_id FK profiles, clinic_id nullable | | |
| type | enum: `appointment_reminder, appointment_confirmed, appointment_cancelled, appointment_rescheduled, vaccination_due, deworming_due` | |
| channel | enum: `push, email` | una fila por canal |
| payload | jsonb | datos para plantilla |
| scheduled_for | timestamptz | cuándo debe enviarse |
| status | enum: `pending, sent, failed, cancelled` | |
| attempts | int DEFAULT 0 | reintentos con backoff |
| sent_at, last_error | | |

**`device_tokens`** — `user_id, fcm_token UNIQUE, platform enum: ios, android, updated_at`.

`pg_cron` (cada 15 min) encola recordatorios de vacunas/desparasitaciones próximas y dispara la
Edge Function `send-reminders` para procesar `notifications` pendientes.

### 3.7 Suscripciones (preparación, sin cobro en MVP)

**`plans`** — `code UNIQUE, name, price_cents, currency 'MXN', billing_interval enum: month, year, max_veterinarians int nullable, features jsonb, is_active`.

**`subscriptions`** — `clinic_id UNIQUE, plan_id, status enum: trialing, active, past_due, canceled, current_period_start/end, stripe_customer_id nullable, stripe_subscription_id nullable`.
En el MVP toda clínica activa recibe una suscripción al plan `beta` sin Stripe.

### 3.8 Auditoría

**`audit_log`** — append-only (sin políticas de UPDATE/DELETE; revocados a todos los roles).
`id bigint identity, occurred_at, actor_id nullable, clinic_id nullable, table_name, record_id, action enum: insert, update, delete, old_data jsonb, new_data jsonb`.
Poblada por triggers en: `clinic_members, appointments, consultations, consultation_addenda, prescriptions, vaccinations, dewormings, medical_records, subscriptions, clinics, profiles(is_superadmin)`.

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

| Recurso | Superadmin | Admin clínica | Veterinario | Recepcionista | Propietario |
|---|---|---|---|---|---|
| Clínicas (todas) | CRUD | — | — | — | — |
| Su clínica (config) | R | RU | R | R | — |
| Personal (clinic_members) | R | CRUD | R | R | — |
| Servicios y horarios | R | CRUD | R (los suyos) | R | R (catálogo de su clínica) |
| Mascotas | — | R (relacionadas) | R (relacionadas) | CRU (relacionadas) | CRUD (las suyas) |
| Citas | — | CRUD | RU (las suyas) | CRUD | CR (las suyas: crear/cancelar) |
| Expedientes y consultas | — | R | CRUD | — (solo existencia, sin detalle médico) | R (sus mascotas) |
| Recetas | — | R | CRUD (emite) | — | R (sus mascotas) |
| Notificaciones | — | R (de su clínica) | R (las suyas) | R (de su clínica) | R (las suyas) |
| Suscripción de clínica | CRUD | R | — | — | — |
| audit_log | R | R (solo su clínica) **[Propuesta]** | — | — | — |

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
