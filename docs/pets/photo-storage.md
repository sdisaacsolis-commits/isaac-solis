# Fotografías privadas de mascotas

> Fase 4. Bucket `pet-photos` (privado), migración 0019.

## Estructura de rutas — decisión

`pets/{petId}/{fileId}.webp` (ambos UUID aleatorios).

Se descartó `organizations/{org}/clinics/{clinic}/pets/...` porque la mascota es una
identidad global: su foto no pertenece a una clínica, y una ruta clínica-céntrica
rompería al compartir o transferir. La ruta elegida no revela PII (solo UUIDs) y el
nombre de archivo NUNCA lo controla el usuario (`randomUUID()`), sin sobrescritura
(`upsert: false`).

## Políticas de Storage

Sobre `storage.objects` (helper `pet_id_from_storage_path` extrae el uuid de forma
segura, null si la ruta no cumple el formato):

- SELECT: `can_access_pet(petId)` — solo miembros con acceso a la mascota.
- INSERT/UPDATE/DELETE: `can_manage_pet(petId)` — personal operativo/admins.
- Probado en pgTAP 08: otra clínica ni ve ni puede subir (caso 18).

## Flujo de subida (solo servidor)

1. Validación de tamaño (≤5 MB) y MIME permitido (JPEG/PNG/WebP; **SVG excluido**).
2. Procesamiento con **sharp**: `rotate()` aplica la orientación EXIF, `resize` a máximo
   1024px, conversión a WebP (calidad 82). sharp NO copia metadatos EXIF/GPS por defecto,
   por lo que la imagen final queda sin ellos.
3. Subida con el cliente del USUARIO (llave anon + sesión): las políticas de Storage
   aplican; jamás service_role.
4. `pets.photo_path` guarda SOLO la ruta interna (CHECK de formato en la tabla); nunca
   URLs firmadas.
5. Reemplazo: sube nueva → actualiza fila → elimina anterior (mejor esfuerzo; un huérfano
   queda inaccesible por RLS).

## Lectura

`firmarFotoMascota(path)` genera URL firmada de corta duración
(`PET_PHOTO_SIGNED_URL_SECONDS`, default 300s) en Server Components. Las URLs firmadas
no se registran ni persisten.

## Validación pendiente

La subida real end-to-end requiere Supabase Storage (Docker): las políticas y el flujo de
objetos están probados en pgTAP contra el shim; el procedimiento de validación con
Supabase local está en docs/pets/testing.md.
