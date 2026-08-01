-- ============================================================================
-- Fase 8.1 — Reseñas verificadas (opiniones ligadas a citas completadas)
-- ============================================================================
-- Confianza estructural (como los folios): SOLO el propietario que asistió a
-- una cita `completed` puede reseñarla, y a lo sumo UNA reseña por cita. La
-- clínica responde públicamente y puede REPORTAR, pero jamás edita el texto
-- del propietario; ocultar una reseña es acto de moderación elevado (admin de
-- la organización), con motivo y auditoría. Réplica del patrón de opiniones
-- verificadas del marketplace (docs/product/doctoralia-audit.md §2.3).
-- ============================================================================

-- published = visible; hidden = oculta por moderación (contenido conservado).
create type public.review_status as enum ('published', 'hidden');

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete restrict,
  owner_id uuid not null references public.pet_owners (id) on delete restrict,
  -- Snapshot del veterinario reseñado (para agregados por profesional aunque
  -- el miembro cambie después).
  veterinarian_clinic_member_id uuid not null
    references public.clinic_members (id) on delete restrict,
  author_user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text check (title is null or char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 3 and 2000),
  status public.review_status not null default 'published',
  -- Respuesta pública de la clínica (una sola; texto propio, no edita la reseña).
  clinic_reply text check (clinic_reply is null or char_length(btrim(clinic_reply)) between 1 and 2000),
  clinic_reply_at timestamptz,
  clinic_reply_by uuid references public.profiles (id) on delete set null,
  -- Moderación.
  reported_at timestamptz,
  reported_by uuid references public.profiles (id) on delete set null,
  report_reason text check (report_reason is null or char_length(report_reason) <= 500),
  hidden_at timestamptz,
  hidden_by uuid references public.profiles (id) on delete set null,
  hidden_reason text check (hidden_reason is null or char_length(hidden_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint reviews_oculta_consistente check (
    status <> 'hidden' or (hidden_at is not null and hidden_reason is not null)
  ),
  constraint reviews_respuesta_consistente check (
    clinic_reply is null or (clinic_reply_at is not null and clinic_reply_by is not null)
  )
);

comment on table public.reviews is
  'Opinión verificada: una por cita completada, del propietario que asistió. La clínica responde/reporta; ocultar es moderación elevada. Contenido nunca se borra.';

create index reviews_clinica_idx on public.reviews (clinic_id, created_at desc);
create index reviews_vet_idx
  on public.reviews (veterinarian_clinic_member_id, created_at desc);
create index reviews_publicadas_idx
  on public.reviews (clinic_id)
  where status = 'published' and deleted_at is null;

alter table public.reviews enable row level security;
alter table public.reviews force row level security;

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

create trigger reviews_enforce_organization
  before insert or update of clinic_id, organization_id on public.reviews
  for each row execute function public.enforce_clinic_organization();

-- Integridad estructural de la reseña: la cita debe estar COMPLETADA, ser de la
-- misma clínica/mascota/propietario/veterinario, y el autor debe ser la cuenta
-- vinculada del propietario. Es la "verificación" (asistió de verdad).
create or replace function public.enforce_review_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments%rowtype;
begin
  select * into v_appt from public.appointments a where a.id = new.appointment_id;
  if not found then
    raise exception 'CITA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_appt.status <> 'completed' then
    raise exception 'CITA_NO_COMPLETADA: solo se reseña una cita atendida.'
      using errcode = '23514';
  end if;
  if v_appt.clinic_id <> new.clinic_id or v_appt.pet_id <> new.pet_id
     or v_appt.owner_id <> new.owner_id
     or v_appt.veterinarian_clinic_member_id <> new.veterinarian_clinic_member_id then
    raise exception 'RESENA_INCONSISTENTE: los datos no corresponden a la cita.'
      using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.pet_owners o
    where o.id = new.owner_id and o.user_id = new.author_user_id
  ) then
    raise exception 'AUTOR_INVALIDO: solo el propietario de la cita puede reseñar.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_review_refs() from public, anon, authenticated;

create trigger reviews_enforce_refs
  before insert or update of appointment_id, clinic_id, pet_id, owner_id,
    veterinarian_clinic_member_id, author_user_id on public.reviews
  for each row execute function public.enforce_review_refs();

-- ----------------------------------------------------------------------------
-- Historial de moderación (append-only): reporte, ocultamiento, restauración.
-- ----------------------------------------------------------------------------
create table public.review_moderation_events (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  action text not null check (action in ('reported', 'hidden', 'restored', 'replied')),
  reason text check (reason is null or char_length(reason) <= 500),
  actor_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index review_moderation_events_idx
  on public.review_moderation_events (review_id, created_at);

alter table public.review_moderation_events enable row level security;
alter table public.review_moderation_events force row level security;

-- ----------------------------------------------------------------------------
-- Privilegios mínimos: los clientes NO escriben directo; todo por RPCs.
-- ----------------------------------------------------------------------------
revoke all on table public.reviews from public, anon, authenticated;
grant select on table public.reviews to authenticated;
grant all on table public.reviews to service_role;

revoke all on table public.review_moderation_events from public, anon, authenticated;
grant select on table public.review_moderation_events to authenticated;
grant select, insert on table public.review_moderation_events to service_role;
revoke update, delete, truncate on table public.review_moderation_events from service_role;

-- ----------------------------------------------------------------------------
-- Políticas de lectura (autenticados): el autor ve la suya; el personal de la
-- clínica y la administración de la organización ven las de su clínica; el
-- público consume por RPCs curadas (SECURITY DEFINER), no por estas políticas.
-- ----------------------------------------------------------------------------
create policy reviews_select_autor on public.reviews
  for select to authenticated
  using (author_user_id = (select auth.uid()));
create policy reviews_select_clinica on public.reviews
  for select to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_organization_admin(organization_id));
create policy reviews_select_superadmin on public.reviews
  for select to authenticated
  using (public.current_user_is_superadmin());

create policy review_moderation_events_select on public.review_moderation_events
  for select to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_organization_admin(organization_id));
create policy review_moderation_events_select_superadmin on public.review_moderation_events
  for select to authenticated
  using (public.current_user_is_superadmin());

-- ----------------------------------------------------------------------------
-- Agregados de calificación (SECURITY DEFINER: los usa el sitio público).
-- Solo reseñas publicadas y no borradas.
-- ----------------------------------------------------------------------------
create or replace function public.clinic_rating(p_clinic_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'average', round(avg(rating)::numeric, 2),
    'count', count(*))
  from public.reviews r
  where r.clinic_id = p_clinic_id
    and r.status = 'published' and r.deleted_at is null;
$$;

revoke all on function public.clinic_rating(uuid) from public, anon;
grant execute on function public.clinic_rating(uuid) to anon, authenticated, service_role;
