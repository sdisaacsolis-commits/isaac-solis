-- ============================================================================
-- Migración 0003 — Perfiles de usuario
-- ============================================================================
-- Un perfil 1:1 con auth.users. No copia datos sensibles de auth (contraseñas,
-- factores, etc.); solo un display_name opcional desde los metadatos públicos.
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text check (first_name is null or char_length(first_name) <= 100),
  last_name text check (last_name is null or char_length(last_name) <= 100),
  display_name text check (display_name is null or char_length(display_name) <= 120),
  phone text check (phone is null or phone ~ '^\+[0-9]{7,15}$'),
  avatar_url text,
  preferred_locale text not null default 'es-MX',
  timezone text not null default 'America/Mexico_City',
  is_superadmin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.profiles is
  'Perfil de aplicación 1:1 con auth.users. is_superadmin solo puede cambiarlo backend o un superadmin.';

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Privilegios mínimos: el cliente nunca inserta ni borra perfiles, y la lista
-- de columnas actualizables excluye is_superadmin y deleted_at (defensa en
-- profundidad adicional a las políticas RLS y al trigger de protección).
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (first_name, last_name, display_name, phone, avatar_url, preferred_locale, timezone)
  on table public.profiles to authenticated;

-- ----------------------------------------------------------------------------
-- Alta automática de perfil al registrarse un usuario.
-- SECURITY DEFINER: se ejecuta desde un trigger sobre auth.users y debe poder
-- insertar en public.profiles sin depender del rol que registró al usuario.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(
      btrim(coalesce(
        new.raw_user_meta_data ->> 'display_name',
        new.raw_user_meta_data ->> 'full_name',
        ''
      )),
      ''
    )
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Protección del indicador de superadministrador (defensa en profundidad):
-- nadie con sesión de usuario puede cambiarlo salvo que ya sea superadmin.
-- Contextos de servidor (service_role, migraciones) no tienen auth.uid() y
-- pueden operar; el cambio queda registrado en audit_log (migración 0007).
-- ----------------------------------------------------------------------------
create or replace function public.protect_superadmin_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new; -- contexto de backend/migración, sin sesión de usuario
  end if;
  if not public.current_user_is_superadmin() then
    raise exception 'PERMISO_DENEGADO: solo un superadministrador puede modificar is_superadmin.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_superadmin_flag() from public, anon, authenticated;

create trigger profiles_protect_superadmin
  before update on public.profiles
  for each row
  when (old.is_superadmin is distinct from new.is_superadmin)
  execute function public.protect_superadmin_flag();
