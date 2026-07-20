-- ============================================================================
-- Shim de entorno Supabase para PostgreSQL "plano" — SOLO PRUEBAS LOCALES/CI.
-- ============================================================================
-- NO es una migración y NUNCA se ejecuta contra Supabase real: reproduce el
-- mínimo del entorno (roles, esquema auth, extensiones y privilegios por
-- defecto) para poder aplicar las migraciones y correr pgTAP donde no hay
-- Docker. Ver docs/database/local-testing.md.
-- ============================================================================

-- Roles de runtime de Supabase
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

-- Extensiones donde las instala Supabase
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to public;

-- Esquema auth mínimo (id + email + metadatos públicos; nada sensible)
create schema if not exists auth;
grant usage on schema auth to public;

create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- auth.uid() / auth.jwt() como en Supabase: leen los claims del JWT que el
-- gateway coloca en request.jwt.claims (en pruebas se fijan con set_config).
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb;
$$;

grant execute on function auth.uid(), auth.jwt() to public;

-- Esquema storage mínimo (buckets/objects + foldername), como en Supabase.
create schema if not exists storage;
grant usage on schema storage to public;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1 : array_upper(string_to_array(name, '/'), 1) - 1];
$$;

grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to public;

-- Privilegios por defecto equivalentes a los de Supabase en public: los
-- objetos nuevos reciben permisos amplios y cada migración los recorta
-- explícitamente (igual que en el entorno real).
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
