-- ============================================================================
-- Migración 0006 — Invitaciones a clínicas
-- ============================================================================
-- El token de invitación NUNCA se guarda en claro: solo su hash SHA-256.
-- El token en claro lo genera y devuelve una única vez la RPC
-- invite_clinic_member (migración 0009) al invitador autorizado; el envío por
-- correo llega en una fase posterior (Resend).
-- token_hash es ilegible para clientes mediante privilegios de columna.
-- ============================================================================

create table public.clinic_invitations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  email text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role public.clinic_role not null,
  token_hash text not null unique check (char_length(token_hash) = 64), -- sha256 hex
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clinic_invitations is
  'Invitación de personal a una clínica. Solo se persiste el hash del token.';

-- Sin duplicados pendientes para el mismo correo, clínica y rol.
create unique index clinic_invitations_sin_pendientes_duplicadas
  on public.clinic_invitations (clinic_id, email, role)
  where status = 'pending';

create index clinic_invitations_clinic_idx on public.clinic_invitations (clinic_id);

alter table public.clinic_invitations enable row level security;
alter table public.clinic_invitations force row level security;

create trigger clinic_invitations_set_updated_at
  before update on public.clinic_invitations
  for each row execute function public.set_updated_at();

-- Normalización del correo (minúsculas, sin espacios) antes de validar.
create or replace function public.normalize_invitation_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;

revoke all on function public.normalize_invitation_email() from public, anon, authenticated;

create trigger clinic_invitations_normalize_email
  before insert or update of email on public.clinic_invitations
  for each row execute function public.normalize_invitation_email();

-- Privilegios: SELECT por columnas EXPLÍCITAS que excluyen token_hash — un
-- `select *` de un cliente falla por diseño; la creación es exclusiva de la
-- RPC y la única mutación permitida a clientes es revocar (política RLS).
revoke all on table public.clinic_invitations from public, anon, authenticated;
grant select (id, clinic_id, email, role, status, expires_at, accepted_at, accepted_by,
              invited_by, created_at, updated_at)
  on table public.clinic_invitations to authenticated;
grant update (status) on table public.clinic_invitations to authenticated;
