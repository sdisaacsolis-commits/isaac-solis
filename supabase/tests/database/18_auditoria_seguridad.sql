-- ============================================================================
-- pgTAP 18 — Fase 12: auditoría de seguridad (RLS de toda la plataforma)
-- ============================================================================
-- Meta-pruebas que GARANTIZAN, para todo el esquema public, la regla innegociable
-- de CLAUDE.md §3: toda tabla se crea con RLS habilitado y FORZADO y con
-- políticas explícitas. Además, `anon` no tiene lectura directa de tablas con
-- datos personales o clínicos (el acceso público va por RPCs curadas).
-- Si una tabla futura olvida la RLS, esta suite falla en CI.
-- ============================================================================
begin;
set search_path = public, extensions;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- 1) TODAS las tablas de public tienen RLS habilitado Y forzado.
select is(
  (select count(*)::int
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and not (c.relrowsecurity and c.relforcerowsecurity)),
  0,
  'auditoría 1: TODA tabla de public tiene RLS habilitado y forzado (CLAUDE.md §3)'
);

-- 2) TODA tabla de public tiene al menos una política explícita, SALVO las
--    tablas "deny-all" a propósito: los contadores de folio, que solo tocan
--    funciones SECURITY DEFINER (RLS forzado + sin política = acceso nulo para
--    cualquier rol). Se listan de forma explícita para que una tabla nueva sin
--    política —por olvido— sí falle la auditoría.
select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and not exists (select 1 from pg_policy p where p.polrelid = c.oid)),
  array['appointment_folio_counters', 'clinical_folio_counters', 'prescription_folio_counters']::text[],
  'auditoría 2: solo los contadores de folio son deny-all sin política (el resto tiene política)'
);

-- 3) Hay un número saludable de tablas cubiertas (evita un esquema vacío que
--    pasaría 1 y 2 por vacuidad).
select cmp_ok(
  (select count(*)::int
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'),
  '>=', 40,
  'auditoría 3: el esquema cubre las tablas esperadas de la plataforma'
);

-- 4) Ninguna tabla con datos personales/clínicos expone filas a `anon` VÍA
--    POLÍTICA (ni por rol anon ni por PUBLIC/oid 0). El acceso público
--    —marketplace, reseñas— va por RPCs SECURITY DEFINER, no por la tabla.
--    Se comprueba sobre pg_policy (definido por migración): es independiente del
--    entorno, a diferencia de los GRANT (el shim local otorga de más a anon).
select is(
  (select count(*)::int from pg_policy p
   where p.polrelid = format('public.%I', t)::regclass
     and (0 = any(p.polroles)
          or (select oid from pg_roles where rolname = 'anon') = any(p.polroles))),
  0,
  format('auditoría 4: ninguna política de %s aplica a anon/PUBLIC', t)
)
from unnest(array[
  'appointments', 'pet_owners', 'pets', 'clinical_encounters', 'diagnoses',
  'prescriptions', 'vaccination_records', 'reviews', 'subscriptions',
  'clinic_members', 'clinic_invitations', 'audit_log', 'device_tokens'
]) as t;

-- 5) `audit_log` es append-only: no existe NINGUNA política de UPDATE ni DELETE.
select is(
  (select count(*)::int from pg_policy p
   where p.polrelid = 'public.audit_log'::regclass and p.polcmd in ('w', 'd')),
  0,
  'auditoría 5: audit_log no tiene políticas de UPDATE ni DELETE (append-only)'
);

select * from finish();
rollback;
