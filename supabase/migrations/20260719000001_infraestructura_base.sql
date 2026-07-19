-- ============================================================================
-- Migración 0001 — Infraestructura base
-- ============================================================================
-- Solo infraestructura transversal; las tablas del producto llegan en la Fase 2
-- (ver ROADMAP.md). Reglas: DATABASE_DESIGN.md §1 y CLAUDE.md §15-17.
-- ============================================================================

-- Generación de UUID (gen_random_uuid) y funciones criptográficas.
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- set_updated_at: función de trigger reutilizada por todas las tablas.
-- Toda tabla del producto lleva created_at/updated_at (DATABASE_DESIGN.md §1);
-- este trigger mantiene updated_at automáticamente en cada UPDATE.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger de infraestructura: fija updated_at = now() en cada UPDATE. Uso: '
  'create trigger <tabla>_set_updated_at before update on <tabla> '
  'for each row execute function public.set_updated_at();';
