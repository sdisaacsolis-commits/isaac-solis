-- ============================================================================
-- Fase 7 — Vacunación: catálogo, registros inmutables, historial y documentos
-- ============================================================================
-- Una vacunación APLICADA es un evento clínico histórico: jamás se edita ni
-- se sobrescribe; las correcciones son anular (contenido intacto) + registrar
-- de nuevo. Los registros históricos aportados por el propietario se
-- distinguen SIEMPRE por su fuente y nunca se presentan como verificados por
-- Dogtoralia. El catálogo es interno y NO prescriptivo: no indica qué vacuna
-- "debe" aplicarse; el intervalo por defecto es solo ayuda editable que el
-- veterinario confirma (docs/vaccination/domain-model.md).
-- ============================================================================

-- Catálogo por organización (el catálogo global de referencia se pospone:
-- decisión documentada para no introducir contenido prescriptivo).
create table public.vaccines_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 150),
  manufacturer text check (manufacturer is null or char_length(manufacturer) <= 150),
  target_species public.pet_species[] not null default '{}',
  diseases_covered text[] not null default '{}',
  presentation text check (presentation is null or char_length(presentation) <= 150),
  default_booster_interval_days integer
    check (default_booster_interval_days is null
           or default_booster_interval_days between 1 and 3650),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.vaccines_catalog is
  'Catálogo interno de productos por organización. NO prescriptivo: sin recomendaciones médicas; el intervalo por defecto es ayuda editable.';

create index vaccines_catalog_org_idx on public.vaccines_catalog (organization_id, name);

alter table public.vaccines_catalog enable row level security;
alter table public.vaccines_catalog force row level security;

create trigger vaccines_catalog_set_updated_at
  before update on public.vaccines_catalog
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Registro de vacunación (evento inmutable).
-- ----------------------------------------------------------------------------
create table public.vaccination_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete restrict,
  clinic_pet_relationship_id uuid not null
    references public.clinic_pet_relationships (id) on delete restrict,
  encounter_id uuid references public.clinical_encounters (id) on delete restrict,
  vaccine_catalog_id uuid references public.vaccines_catalog (id) on delete restrict,
  status public.vaccination_record_status not null default 'recorded',
  source public.vaccination_source not null,
  -- Snapshot del producto: el documento histórico no depende del catálogo
  -- mutable actual.
  vaccine_name_snapshot text not null
    check (char_length(btrim(vaccine_name_snapshot)) between 1 and 150),
  manufacturer_snapshot text
    check (manufacturer_snapshot is null or char_length(manufacturer_snapshot) <= 150),
  diseases_snapshot text[] not null default '{}',
  lot_number text check (lot_number is null or char_length(btrim(lot_number)) between 1 and 80),
  -- Excepción documentada y autorizada cuando el lote no está disponible en
  -- una aplicación en clínica (docs/vaccination/lots-and-expiration.md).
  lot_missing_reason text
    check (lot_missing_reason is null or char_length(lot_missing_reason) <= 300),
  expiration_date date,
  administered_at timestamptz not null,
  administered_by_clinic_member_id uuid
    references public.clinic_members (id) on delete restrict,
  route_text text check (route_text is null or char_length(route_text) <= 100),
  application_site text
    check (application_site is null or char_length(application_site) <= 150),
  dose_text text check (dose_text is null or char_length(dose_text) <= 150),
  -- SIEMPRE confirmada por el veterinario; Dogtoralia nunca la calcula de
  -- forma definitiva.
  next_due_at date,
  historical_provider_name text
    check (historical_provider_name is null or char_length(historical_provider_name) <= 200),
  historical_document_reference text
    check (historical_document_reference is null
           or char_length(historical_document_reference) <= 300),
  -- Comprobante aportado (bucket privado vaccination-files; nombre generado
  -- en servidor).
  historical_document_path text
    check (historical_document_path is null or historical_document_path
           ~ '^pets/[0-9a-f-]{36}/vaccinations/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$'),
  notes text check (notes is null or char_length(notes) <= 1000),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text check (void_reason is null or char_length(void_reason) <= 500),
  -- Idempotencia explícita contra doble envío (la semejanza de nombre/fecha
  -- NUNCA se usa para deducir duplicados).
  client_request_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Un producto caducado no pudo aplicarse en esa fecha (integridad global).
  constraint vaccination_records_caducidad_coherente check (
    expiration_date is null or expiration_date >= administered_at::date
  ),
  -- Aplicación en clínica: veterinario que aplica + lote y caducidad (o
  -- excepción justificada).
  constraint vaccination_records_aplicacion_en_clinica check (
    source <> 'administered_in_clinic' or (
      administered_by_clinic_member_id is not null
      and ((lot_number is not null and expiration_date is not null)
           or lot_missing_reason is not null)
    )
  ),
  constraint vaccination_records_proxima_dosis_futura check (
    next_due_at is null or next_due_at > administered_at::date
  ),
  constraint vaccination_records_anulada_consistente check (
    status <> 'voided' or (voided_at is not null and void_reason is not null)
  )
);

comment on table public.vaccination_records is
  'Evento de vacunación (inmutable). source distingue aplicación en clínica de registros históricos aportados; correcciones = anular + registrar de nuevo.';

create unique index vaccination_records_request_unica
  on public.vaccination_records (clinic_id, client_request_id)
  where client_request_id is not null;

create index vaccination_records_mascota_idx
  on public.vaccination_records (pet_id, administered_at desc);
create index vaccination_records_clinica_idx
  on public.vaccination_records (clinic_id, administered_at desc);
create index vaccination_records_proximas_idx
  on public.vaccination_records (clinic_id, next_due_at)
  where status = 'recorded' and next_due_at is not null;

alter table public.vaccination_records enable row level security;
alter table public.vaccination_records force row level security;

create trigger vaccination_records_set_updated_at
  before update on public.vaccination_records
  for each row execute function public.set_updated_at();

create trigger vaccination_records_enforce_organization
  before insert or update of clinic_id, organization_id on public.vaccination_records
  for each row execute function public.enforce_clinic_organization();

-- Integridad de referencias y reglas temporales (en trigger, no en CHECK,
-- porque dependen de now() y de otras tablas).
create or replace function public.enforce_vaccination_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.administered_at > now() + interval '5 minutes' then
    raise exception 'FECHA_INVALIDA: la fecha de aplicación no puede ser futura'
      using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.clinic_pet_relationships r
    where r.id = new.clinic_pet_relationship_id
      and r.clinic_id = new.clinic_id and r.pet_id = new.pet_id
      and r.status = 'active' and r.deleted_at is null
  ) then
    raise exception 'MASCOTA_SIN_RELACION: la mascota no tiene relación activa con la clínica'
      using errcode = '23514';
  end if;
  if new.encounter_id is not null and not exists (
    select 1 from public.clinical_encounters e
    where e.id = new.encounter_id and e.clinic_id = new.clinic_id
      and e.pet_id = new.pet_id and e.status <> 'voided' and e.deleted_at is null
  ) then
    raise exception 'CONSULTA_INCONSISTENTE: la consulta no corresponde a la clínica y mascota'
      using errcode = '23514';
  end if;
  if new.administered_by_clinic_member_id is not null and not exists (
    select 1 from public.clinic_members m
    where m.id = new.administered_by_clinic_member_id
      and m.clinic_id = new.clinic_id and m.role = 'veterinarian'
      and m.status = 'active' and m.deleted_at is null
  ) then
    raise exception 'MIEMBRO_NO_VETERINARIO: quien aplica debe ser veterinario activo de la clínica'
      using errcode = '23514';
  end if;
  if new.vaccine_catalog_id is not null and not exists (
    select 1 from public.vaccines_catalog vc
    where vc.id = new.vaccine_catalog_id
      and vc.organization_id = new.organization_id and vc.deleted_at is null
  ) then
    raise exception 'CATALOGO_INCONSISTENTE: el producto no pertenece al catálogo de la organización'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_vaccination_refs() from public, anon, authenticated;

create trigger vaccination_records_enforce_refs
  before insert or update of clinic_id, pet_id, encounter_id, clinic_pet_relationship_id,
    administered_by_clinic_member_id, vaccine_catalog_id, administered_at
  on public.vaccination_records
  for each row execute function public.enforce_vaccination_refs();

-- Inmutabilidad de dos capas: sin grants de UPDATE para clientes y, además,
-- este trigger bloquea toda modificación fuera de las RPCs internas (GUC),
-- incluso para roles que omiten RLS. Única transición: recorded → voided.
create or replace function public.enforce_vaccination_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    if not (old.status = 'recorded' and new.status = 'voided') then
      raise exception 'TRANSICION_INVALIDA: % → % no está permitida', old.status, new.status
        using errcode = '23514';
    end if;
  end if;
  if coalesce(current_setting('app.vaccination_admin_op', true), '') = '' then
    raise exception 'VACUNACION_INMUTABLE: un registro de vacunación no se modifica; anula y registra de nuevo'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_vaccination_immutable() from public, anon, authenticated;

create trigger vaccination_records_enforce_immutable
  before update on public.vaccination_records
  for each row execute function public.enforce_vaccination_immutable();

-- ----------------------------------------------------------------------------
-- Historial de estados (append-only, por trigger).
-- ----------------------------------------------------------------------------
create table public.vaccination_status_history (
  id uuid primary key default gen_random_uuid(),
  vaccination_record_id uuid not null
    references public.vaccination_records (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  from_status public.vaccination_record_status,
  to_status public.vaccination_record_status not null,
  reason text check (reason is null or char_length(reason) <= 500),
  metadata jsonb,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index vaccination_status_history_idx
  on public.vaccination_status_history (vaccination_record_id, created_at);

alter table public.vaccination_status_history enable row level security;
alter table public.vaccination_status_history force row level security;

create or replace function public.log_vaccination_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.vaccination_status_history
      (vaccination_record_id, organization_id, clinic_id, from_status, to_status, metadata,
       changed_by)
    values (new.id, new.organization_id, new.clinic_id, null, new.status,
            jsonb_build_object('source', new.source), (select auth.uid()));
  elsif old.status is distinct from new.status then
    insert into public.vaccination_status_history
      (vaccination_record_id, organization_id, clinic_id, from_status, to_status, reason,
       changed_by)
    values (new.id, new.organization_id, new.clinic_id, old.status, new.status,
            nullif(current_setting('app.vaccination_reason', true), ''), (select auth.uid()));
  end if;
  return new;
end;
$$;

revoke all on function public.log_vaccination_status() from public, anon, authenticated;

create trigger vaccination_records_log_status
  after insert or update of status on public.vaccination_records
  for each row execute function public.log_vaccination_status();

-- ----------------------------------------------------------------------------
-- Comprobante congelado por aplicación (la cartilla se consolida
-- dinámicamente desde los eventos inmutables; no se congela).
-- ----------------------------------------------------------------------------
create table public.vaccination_documents (
  id uuid primary key default gen_random_uuid(),
  vaccination_record_id uuid not null unique
    references public.vaccination_records (id) on delete cascade,
  content jsonb not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  template_version integer not null default 1 check (template_version >= 1),
  storage_path text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes > 0),
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.vaccination_documents is
  'Comprobante individual congelado al registrar una aplicación en clínica. La cartilla se genera dinámicamente desde eventos inmutables.';

alter table public.vaccination_documents enable row level security;
alter table public.vaccination_documents force row level security;

create trigger vaccination_documents_frozen
  before update or delete on public.vaccination_documents
  for each row execute function public.enforce_document_frozen();

-- ----------------------------------------------------------------------------
-- Outbox de recordatorios de vacunación (misma arquitectura que el outbox de
-- citas: intención en la MISMA transacción, envío posterior idempotente).
-- ----------------------------------------------------------------------------
create table public.vaccination_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  vaccination_record_id uuid not null
    references public.vaccination_records (id) on delete cascade,
  type public.vaccination_notification_type not null,
  channel public.notification_channel not null default 'email',
  recipient_name text,
  recipient_email text check (recipient_email is null or position('@' in recipient_email) > 1),
  -- Datos OPERATIVOS mínimos (mascota, producto, fecha); nunca contenido
  -- clínico sensible innecesario.
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz not null default now(),
  status public.notification_status not null default 'pending',
  attempts smallint not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key),
  constraint vaccination_notifications_email_con_destinatario
    check (channel <> 'email' or recipient_email is not null)
);

create index vaccination_notifications_pendientes_idx
  on public.vaccination_notifications (scheduled_for)
  where status = 'pending';
create index vaccination_notifications_registro_idx
  on public.vaccination_notifications (vaccination_record_id);

alter table public.vaccination_notifications enable row level security;
alter table public.vaccination_notifications force row level security;

create trigger vaccination_notifications_set_updated_at
  before update on public.vaccination_notifications
  for each row execute function public.set_updated_at();

create trigger vaccination_notifications_enforce_organization
  before insert or update of clinic_id, organization_id on public.vaccination_notifications
  for each row execute function public.enforce_clinic_organization();

-- Bucket privado para comprobantes históricos aportados (URLs firmadas
-- cortas; MIME verificado por contenido real en el servidor web).
insert into storage.buckets (id, name, public)
values ('vaccination-files', 'vaccination-files', false)
on conflict (id) do nothing;
