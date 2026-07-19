-- ============================================================================
-- Migración 0019 — Bucket privado de fotografías de mascotas (Fase 4)
-- ============================================================================
-- Bucket `pet-photos` PRIVADO. Ruta interna: pets/{petId}/{fileId}.webp
-- Decisión de estructura (docs/pets/photo-storage.md): la mascota es una
-- identidad global, por lo que la ruta NO incluye organización/clínica (una
-- foto no pertenece a una clínica) y solo revela UUIDs aleatorios, sin PII.
-- Las URLs firmadas se generan EXCLUSIVAMENTE en el servidor.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('pet-photos', 'pet-photos', false)
on conflict (id) do nothing;

-- Extrae el uuid de mascota de la ruta; null si la ruta no cumple el formato
-- (una política nunca debe fallar por un cast inválido).
create or replace function public.pet_id_from_storage_path(p_name text)
returns uuid
language plpgsql
immutable
security definer
set search_path = ''
as $$
begin
  if p_name ~ '^pets/[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z]{3,4}$' then
    return split_part(p_name, '/', 2)::uuid;
  end if;
  return null;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.pet_id_from_storage_path(text) from public, anon;
grant execute on function public.pet_id_from_storage_path(text) to authenticated, service_role;

-- Lectura: solo miembros con acceso a la mascota (misma regla que la tabla).
create policy pet_photos_select_relacionados
  on storage.objects for select to authenticated
  using (
    bucket_id = 'pet-photos'
    and public.can_access_pet(public.pet_id_from_storage_path(name))
  );

-- Subir/reemplazar/eliminar: personal que puede gestionar la mascota.
create policy pet_photos_insert_gestores
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pet-photos'
    and public.can_manage_pet(public.pet_id_from_storage_path(name))
  );

create policy pet_photos_update_gestores
  on storage.objects for update to authenticated
  using (
    bucket_id = 'pet-photos'
    and public.can_manage_pet(public.pet_id_from_storage_path(name))
  )
  with check (
    bucket_id = 'pet-photos'
    and public.can_manage_pet(public.pet_id_from_storage_path(name))
  );

create policy pet_photos_delete_gestores
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'pet-photos'
    and public.can_manage_pet(public.pet_id_from_storage_path(name))
  );
