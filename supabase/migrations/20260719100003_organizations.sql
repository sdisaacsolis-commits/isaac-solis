-- ============================================================================
-- Migración 0004 — Organizaciones y sus miembros
-- ============================================================================
-- La organización es el sujeto comercial (PRD §7.4): agrupa una o varias
-- clínicas. La creación de organizaciones SIEMPRE pasa por la RPC
-- create_organization_with_owner (migración 0009): no hay INSERT directo.
-- ============================================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  legal_name text check (legal_name is null or char_length(legal_name) <= 200),
  slug text unique
    check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60)),
  tax_id text check (tax_id is null or tax_id ~ '^[A-ZÑ&0-9]{12,13}$'), -- RFC (validación ligera)
  status public.organization_status not null default 'active',
  plan_code text not null default 'beta',
  included_active_veterinarians integer not null default 1
    check (included_active_veterinarians >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.organizations is
  'Sujeto comercial: empresa o grupo veterinario. slug reservado para uso público futuro.';
comment on column public.organizations.plan_code is
  'Código de plan comercial (Fase 11 lo liga a la tabla plans). MVP: beta.';
comment on column public.organizations.included_active_veterinarians is
  'Veterinarios activos incluidos en el plan; el excedente se cobrará en el futuro.';

alter table public.organizations enable row level security;
alter table public.organizations force row level security;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger organizations_slug_normalize
  before insert or update of slug on public.organizations
  for each row execute function public.normalize_slug_and_check_reserved();

-- Privilegios: sin INSERT/DELETE directo para clientes (RPC / backend).
-- status, plan_code e included_active_veterinarians solo cambian desde backend.
revoke all on table public.organizations from public, anon, authenticated;
grant select on table public.organizations to authenticated;
grant update (name, legal_name, slug, tax_id) on table public.organizations to authenticated;

-- ----------------------------------------------------------------------------
-- Miembros de organización
-- ----------------------------------------------------------------------------
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.organization_role not null default 'member',
  status public.membership_status not null default 'active',
  joined_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.organization_members is
  'Membresía y rol de un usuario dentro de una organización.';

-- Una sola membresía viva (no removida ni borrada) por usuario y organización.
create unique index organization_members_una_membresia_viva
  on public.organization_members (organization_id, user_id)
  where deleted_at is null and status <> 'removed';

create index organization_members_user_idx on public.organization_members (user_id);

alter table public.organization_members enable row level security;
alter table public.organization_members force row level security;

create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

revoke all on table public.organization_members from public, anon, authenticated;
grant select on table public.organization_members to authenticated;
grant insert (organization_id, user_id, role, status, joined_at, created_by)
  on table public.organization_members to authenticated;
grant update (role, status, joined_at, deleted_at)
  on table public.organization_members to authenticated;

-- ----------------------------------------------------------------------------
-- Toda organización conserva al menos un owner activo.
-- SECURITY DEFINER: debe contar owners de toda la organización sin que el RLS
-- del actor recorte filas (RLS forzado aplicaría al invocador).
-- ----------------------------------------------------------------------------
create or replace function public.ensure_last_owner_remains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Solo interesa cuando la fila anterior era un owner activo vivo
  if not (old.role = 'owner' and old.status = 'active' and old.deleted_at is null) then
    return coalesce(new, old);
  end if;

  -- La actualización lo mantiene como owner activo: no hay riesgo
  if tg_op = 'UPDATE'
     and new.role = 'owner' and new.status = 'active' and new.deleted_at is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = old.organization_id
      and m.id <> old.id
      and m.role = 'owner'
      and m.status = 'active'
      and m.deleted_at is null
  ) then
    raise exception 'ULTIMO_OWNER: la organización debe conservar al menos un propietario activo.'
      using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.ensure_last_owner_remains() from public, anon, authenticated;

create trigger organization_members_protect_last_owner
  before update or delete on public.organization_members
  for each row execute function public.ensure_last_owner_remains();
