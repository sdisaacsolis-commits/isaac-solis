-- ============================================================================
-- Fase 7 — Recetas: folio, entidad principal, partidas, historial y documento
-- ============================================================================
-- Una receta nace como BORRADOR ligado a una consulta (abierta o finalizada)
-- y solo puede EMITIRSE cuando la consulta está finalizada (decisión
-- documentada en docs/prescriptions/issuing-flow.md). Emitida = inmutable;
-- correcciones mediante sustitución (ambos documentos se conservan) o
-- anulación con motivo. Los folios jamás se reutilizan.
-- ============================================================================

create table public.prescription_folio_counters (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  year smallint not null check (year between 2020 and 2100),
  counter integer not null default 0 check (counter >= 0),
  primary key (clinic_id, year)
);

alter table public.prescription_folio_counters enable row level security;
alter table public.prescription_folio_counters force row level security;

-- Folio concurrente por clínica+año (UPSERT atómico; jamás COUNT+1).
-- Huecos aceptables: una transacción revertida consume el número.
create or replace function public.next_prescription_folio(p_clinic_id uuid, p_year smallint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counter integer;
begin
  insert into public.prescription_folio_counters as c (clinic_id, year, counter)
  values (p_clinic_id, p_year, 1)
  on conflict (clinic_id, year)
  do update set counter = c.counter + 1
  returning counter into v_counter;
  return format('REC-%s-%s', p_year, lpad(v_counter::text, 6, '0'));
end;
$$;

revoke all on function public.next_prescription_folio(uuid, smallint)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Receta. Los snapshots (clínica, prescriptor+cédula, mascota, propietario)
-- se generan EXCLUSIVAMENTE en servidor al emitir: no existe grant de
-- escritura sobre esas columnas y el documento histórico nunca depende de
-- datos mutables de perfiles actuales.
-- ----------------------------------------------------------------------------
create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  clinic_pet_relationship_id uuid not null
    references public.clinic_pet_relationships (id) on delete restrict,
  pet_id uuid not null references public.pets (id) on delete restrict,
  encounter_id uuid not null references public.clinical_encounters (id) on delete restrict,
  responsible_owner_id uuid not null references public.pet_owners (id) on delete restrict,
  prescriber_clinic_member_id uuid not null
    references public.clinic_members (id) on delete restrict,
  status public.prescription_status not null default 'draft',
  folio text check (folio is null or folio ~ '^REC-[0-9]{4}-[0-9]{6}$'),
  issued_at timestamptz,
  issued_by uuid references public.profiles (id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text check (void_reason is null or char_length(void_reason) <= 500),
  supersedes_prescription_id uuid references public.prescriptions (id) on delete restrict,
  superseded_by_prescription_id uuid references public.prescriptions (id) on delete restrict,
  general_instructions text
    check (general_instructions is null or char_length(general_instructions) <= 2000),
  clinical_indication text
    check (clinical_indication is null or char_length(clinical_indication) <= 1000),
  valid_until date,
  clinic_snapshot jsonb,
  prescriber_snapshot jsonb,
  pet_snapshot jsonb,
  owner_snapshot jsonb,
  version integer not null default 1,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (clinic_id, folio),
  constraint prescriptions_sin_autorreferencia check (
    supersedes_prescription_id is distinct from id
    and superseded_by_prescription_id is distinct from id
  ),
  -- Todo estado posterior a draft proviene de una emisión: folio, fecha,
  -- emisor y snapshots quedan congelados y presentes.
  constraint prescriptions_emitida_consistente check (
    status = 'draft' or (
      folio is not null and issued_at is not null and issued_by is not null
      and clinic_snapshot is not null and prescriber_snapshot is not null
      and pet_snapshot is not null and owner_snapshot is not null
    )
  ),
  constraint prescriptions_anulada_consistente check (
    status <> 'voided' or (voided_at is not null and void_reason is not null)
  ),
  constraint prescriptions_sustituida_consistente check (
    status <> 'superseded' or superseded_by_prescription_id is not null
  )
);

comment on table public.prescriptions is
  'Receta veterinaria. draft editable; issued inmutable con folio y snapshots de servidor; superseded/voided conservan el contenido.';
comment on column public.prescriptions.prescriber_snapshot is
  'Congelado al emitir (nombre y cédula profesional del veterinario). Solo servidor.';

-- Un solo sustituto vivo por receta original (sin ciclos ni carreras).
create unique index prescriptions_sustituto_activo
  on public.prescriptions (supersedes_prescription_id)
  where supersedes_prescription_id is not null
    and deleted_at is null and status <> 'voided';

create index prescriptions_clinica_idx on public.prescriptions (clinic_id, created_at desc);
create index prescriptions_mascota_idx on public.prescriptions (pet_id, created_at desc);
create index prescriptions_consulta_idx on public.prescriptions (encounter_id);
create index prescriptions_estado_idx on public.prescriptions (clinic_id, status);

alter table public.prescriptions enable row level security;
alter table public.prescriptions force row level security;

create trigger prescriptions_set_updated_at
  before update on public.prescriptions
  for each row execute function public.set_updated_at();

create trigger prescriptions_enforce_organization
  before insert or update of clinic_id, organization_id on public.prescriptions
  for each row execute function public.enforce_clinic_organization();

create trigger prescriptions_bump_version
  before update on public.prescriptions
  for each row execute function public.bump_version();

-- Integridad de referencias: prescriptor veterinario activo de la clínica,
-- relación clínica–mascota vigente, consulta de la misma clínica y mascota
-- (no anulada) y propietario responsable con relación activa a la mascota.
create or replace function public.enforce_prescription_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.clinic_members m
    where m.id = new.prescriber_clinic_member_id
      and m.clinic_id = new.clinic_id and m.role = 'veterinarian'
      and m.status = 'active' and m.deleted_at is null
  ) then
    raise exception 'MIEMBRO_NO_VETERINARIO: el prescriptor debe ser veterinario activo de la clínica'
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
  if not exists (
    select 1 from public.clinical_encounters e
    where e.id = new.encounter_id and e.clinic_id = new.clinic_id
      and e.pet_id = new.pet_id and e.status <> 'voided' and e.deleted_at is null
  ) then
    raise exception 'CONSULTA_INCONSISTENTE: la consulta no corresponde a la clínica y mascota'
      using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.pet_owner_relationships por
    where por.pet_id = new.pet_id and por.owner_id = new.responsible_owner_id
      and por.status = 'active' and por.deleted_at is null
  ) then
    raise exception 'PROPIETARIO_INCONSISTENTE: el propietario responsable no está vinculado a la mascota'
      using errcode = '23514';
  end if;
  if new.supersedes_prescription_id is not null and not exists (
    select 1 from public.prescriptions p
    where p.id = new.supersedes_prescription_id
      and p.clinic_id = new.clinic_id and p.pet_id = new.pet_id
      and p.status in ('issued', 'superseded')
  ) then
    raise exception 'SUSTITUCION_INVALIDA: solo se sustituye una receta emitida de la misma clínica y mascota'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_prescription_refs() from public, anon, authenticated;

create trigger prescriptions_enforce_refs
  before insert or update of clinic_id, pet_id, encounter_id, responsible_owner_id,
    prescriber_clinic_member_id, clinic_pet_relationship_id, supersedes_prescription_id
  on public.prescriptions
  for each row execute function public.enforce_prescription_refs();

-- Máquina de estados (autoridad en la base; espejo TS en @dogtoralia/types).
-- superseded→voided permitido: un documento sustituido también puede anularse
-- administrativamente; voided es terminal y nada se "desemite".
create or replace function public.prescription_transition_allowed(
  p_from public.prescription_status, p_to public.prescription_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'draft'      then p_to = 'issued'
    when 'issued'     then p_to in ('superseded', 'voided')
    when 'superseded' then p_to = 'voided'
    else false
  end;
$$;

-- Inmutabilidad de dos capas: además de RLS (los clientes solo alcanzan
-- borradores propios), este trigger bloquea CUALQUIER cambio fuera de
-- borrador salvo a las RPCs internas (GUC transaccional), incluso para
-- roles que omiten RLS.
create or replace function public.enforce_prescription_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    if not public.prescription_transition_allowed(old.status, new.status) then
      raise exception 'TRANSICION_INVALIDA: % → % no está permitida', old.status, new.status
        using errcode = '23514';
    end if;
    if coalesce(current_setting('app.prescription_admin_op', true), '') = '' then
      raise exception 'OPERACION_RESERVADA: los cambios de estado pasan por las RPCs de recetas'
        using errcode = '42501';
    end if;
  elsif old.status <> 'draft'
     and coalesce(current_setting('app.prescription_admin_op', true), '') = '' then
    raise exception 'RECETA_INMUTABLE: una receta emitida, sustituida o anulada no se modifica'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_prescription_transition() from public, anon, authenticated;

create trigger prescriptions_enforce_transition
  before update on public.prescriptions
  for each row execute function public.enforce_prescription_transition();

-- ----------------------------------------------------------------------------
-- Partidas de la receta. TODO el contenido clínico (dosis, vía, frecuencia,
-- duración) es TEXTO capturado por el veterinario: Dogtoralia no calcula ni
-- valida dosis clínicas — solo estructura, longitud y obligatoriedad.
-- ----------------------------------------------------------------------------
create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id) on delete cascade,
  position integer not null check (position between 1 and 200),
  medication_name text not null check (char_length(btrim(medication_name)) between 1 and 200),
  active_ingredient text
    check (active_ingredient is null or char_length(active_ingredient) <= 200),
  presentation text check (presentation is null or char_length(presentation) <= 200),
  concentration text check (concentration is null or char_length(concentration) <= 100),
  dosage_text text not null check (char_length(btrim(dosage_text)) between 1 and 300),
  route_text text not null check (char_length(btrim(route_text)) between 1 and 100),
  frequency_text text not null check (char_length(btrim(frequency_text)) between 1 and 200),
  duration_text text not null check (char_length(btrim(duration_text)) between 1 and 200),
  quantity_text text check (quantity_text is null or char_length(quantity_text) <= 100),
  instructions text check (instructions is null or char_length(instructions) <= 1000),
  start_date date,
  end_date date check (end_date is null or start_date is null or end_date >= start_date),
  as_needed boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.prescription_items is
  'Partidas de receta: texto clínico capturado por el veterinario (dosage_text jamás es un valor calculado por Dogtoralia). Orden por position.';

-- El orden se conserva por position (sin UNIQUE para permitir reordenar desde
-- el cliente sin transacción); desempate estable por created_at.
create index prescription_items_orden_idx
  on public.prescription_items (prescription_id, position, created_at);

alter table public.prescription_items enable row level security;
alter table public.prescription_items force row level security;

create trigger prescription_items_set_updated_at
  before update on public.prescription_items
  for each row execute function public.set_updated_at();

-- Las partidas solo cambian mientras la receta es borrador vigente.
create or replace function public.enforce_prescription_item_editable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prescription uuid := coalesce(new.prescription_id, old.prescription_id);
begin
  if not exists (
    select 1 from public.prescriptions p
    where p.id = v_prescription and p.status = 'draft' and p.deleted_at is null
  ) then
    raise exception 'RECETA_INMUTABLE: las partidas solo se modifican en borrador'
      using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.enforce_prescription_item_editable() from public, anon, authenticated;

create trigger prescription_items_enforce_editable
  before insert or update or delete on public.prescription_items
  for each row execute function public.enforce_prescription_item_editable();

-- ----------------------------------------------------------------------------
-- Historial de estados (append-only, por trigger).
-- ----------------------------------------------------------------------------
create table public.prescription_status_history (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  from_status public.prescription_status,
  to_status public.prescription_status not null,
  reason text check (reason is null or char_length(reason) <= 500),
  metadata jsonb,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index prescription_status_history_idx
  on public.prescription_status_history (prescription_id, created_at);

alter table public.prescription_status_history enable row level security;
alter table public.prescription_status_history force row level security;

create or replace function public.log_prescription_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.prescription_status_history
      (prescription_id, organization_id, clinic_id, from_status, to_status, reason, changed_by)
    values (new.id, new.organization_id, new.clinic_id, null, new.status,
            nullif(current_setting('app.prescription_reason', true), ''), (select auth.uid()));
  elsif old.status is distinct from new.status then
    insert into public.prescription_status_history
      (prescription_id, organization_id, clinic_id, from_status, to_status, reason, metadata,
       changed_by)
    values (new.id, new.organization_id, new.clinic_id, old.status, new.status,
            nullif(current_setting('app.prescription_reason', true), ''),
            case when new.superseded_by_prescription_id is not null
                 then jsonb_build_object('superseded_by', new.superseded_by_prescription_id) end,
            (select auth.uid()));
  end if;
  return new;
end;
$$;

revoke all on function public.log_prescription_status() from public, anon, authenticated;

create trigger prescriptions_log_status
  after insert or update of status on public.prescriptions
  for each row execute function public.log_prescription_status();

-- ----------------------------------------------------------------------------
-- Documento congelado de la receta emitida: los datos estructurados son la
-- fuente de verdad; al emitir se congela una representación canónica
-- determinista con hash SHA-256 (calculado en la base). La vista imprimible
-- SIEMPRE renderiza desde este contenido, nunca desde datos vivos.
-- storage_path queda preparado para el PDF binario congelado (pendiente
-- documentado: docs/prescriptions/documents.md — no se afirma que exista).
-- ----------------------------------------------------------------------------
create table public.prescription_documents (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null unique
    references public.prescriptions (id) on delete cascade,
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

comment on table public.prescription_documents is
  'Documento canónico congelado al emitir (se genera UNA vez; jamás se regenera). sha256 sobre el contenido canónico jsonb.';

alter table public.prescription_documents enable row level security;
alter table public.prescription_documents force row level security;

-- Congelado absoluto: ni update ni delete, sin excepción por GUC.
create or replace function public.enforce_document_frozen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'DOCUMENTO_INMUTABLE: un documento emitido no se modifica ni se elimina'
    using errcode = '23514';
end;
$$;

revoke all on function public.enforce_document_frozen() from public, anon, authenticated;

create trigger prescription_documents_frozen
  before update or delete on public.prescription_documents
  for each row execute function public.enforce_document_frozen();
