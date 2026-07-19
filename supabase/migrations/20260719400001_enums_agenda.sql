-- ============================================================================
-- Fase 5 — Agenda: enums y extensión btree_gist
-- ============================================================================
-- btree_gist permite EXCLUDE USING gist con igualdad (uuid) + rangos:
-- la restricción anti-traslape de citas vive en la base, no en la aplicación.
create extension if not exists btree_gist with schema extensions;

-- Categorías del catálogo de servicios veterinarios (9).
create type public.service_category as enum (
  'consultation',   -- consulta general
  'vaccination',    -- vacunación
  'surgery',        -- cirugía
  'grooming',       -- estética/baño
  'laboratory',     -- laboratorio
  'imaging',        -- imagenología
  'dental',         -- dental
  'emergency',      -- urgencia
  'other'
);

-- Tipos de excepción de agenda del profesional o de la clínica (8).
create type public.schedule_exception_type as enum (
  'vacation',        -- vacaciones
  'sick_leave',      -- incapacidad
  'personal',        -- permiso personal
  'training',        -- capacitación/congreso
  'holiday',         -- día festivo
  'clinic_closure',  -- cierre de clínica (aplica a todo el personal)
  'special_hours',   -- horario especial: AGREGA disponibilidad fuera del horario base
  'other'
);

-- Estados de una cita (8). La máquina de estados se valida en SQL
-- (validate_appointment_transition) y se refleja en la capa TS.
create type public.appointment_status as enum (
  'requested',            -- solicitada (aún sin confirmar por la clínica)
  'pending_confirmation', -- pre-agendada; falta confirmación del propietario
  'confirmed',            -- confirmada
  'checked_in',           -- paciente en recepción
  'in_progress',          -- en atención
  'completed',            -- atendida (terminal)
  'cancelled',            -- cancelada (terminal)
  'no_show'               -- no se presentó (terminal)
);

-- Origen de la cita (7).
create type public.appointment_source as enum (
  'staff',        -- creada por personal desde el panel
  'phone',        -- llamada telefónica
  'walk_in',      -- llegó sin cita
  'owner_portal', -- portal del propietario (fase posterior)
  'mobile_app',   -- app móvil (fase posterior)
  'whatsapp',     -- WhatsApp (fase posterior)
  'migration'     -- importación de datos
);

-- Canales de notificación. Solo email se envía en esta fase; el resto queda
-- preparado detrás de la interfaz de proveedor (ARCHITECTURE.md §6.1).
create type public.notification_channel as enum ('email', 'whatsapp', 'push', 'sms');

-- Tipos de notificación de cita.
create type public.appointment_notification_type as enum (
  'confirmation',  -- confirmación al agendar
  'reminder_24h',  -- recordatorio 24 horas antes
  'reminder_2h',   -- recordatorio 2 horas antes
  'cancellation',  -- aviso de cancelación
  'reschedule'     -- aviso de reagendamiento
);

-- Estados del outbox de notificaciones.
create type public.notification_status as enum (
  'pending',    -- pendiente de procesar
  'processing', -- tomada por un procesador
  'sent',       -- enviada
  'failed',     -- falló (attempts registra reintentos)
  'cancelled'   -- ya no aplica (p. ej. cita cancelada antes del recordatorio)
);
