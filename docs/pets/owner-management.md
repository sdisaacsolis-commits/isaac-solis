# Gestión de propietarios

> Fase 4. Rutas: `/app/propietarios`, `/app/propietarios/nuevo`, `/app/propietarios/[id]`.

## Alta (RPC `register_owner_with_clinic`)

Transaccional: crea `pet_owners` + `owner_clinic_relationships` (con notas y número de
cliente de LA clínica). Autorizados: recepción, admin de clínica y admins de la
organización. Los veterinarios NO registran propietarios (solo consultan). Normalización
en BD: correo a minúsculas, teléfonos sin separadores (E.164).

El formulario recaba opcionalmente el **aviso de privacidad** (checkbox) y lo registra en
`owner_consents` con versión (`v1.0-2026`), fecha, medio (`in_person`) y actor.

## Detección de duplicados (advertencia, no fusión)

Antes de crear se busca por correo normalizado, teléfono normalizado y nombre+apellidos —
**dentro del alcance RLS del actor**: los registros de otras clínicas no existen para la
consulta, por lo que es imposible enumerar propietarios externos. La UI muestra
"Encontramos posibles coincidencias" con opciones: usar el registro existente o crear de
todos modos (confirmación explícita `confirmDuplicates`). No hay fusión de registros en
esta fase (documentado como funcionalidad futura).

No existe unicidad global por correo/teléfono a propósito: familias comparten contacto.

## Acceso (RLS)

- Lectura (`can_access_owner`): relación activa propietario↔clínica del actor, o vínculo
  activo con una mascota accesible.
- Escritura (`can_manage_owner`): clinic_admin/recepción de una clínica relacionada u
  org admin. Columnas de contacto únicamente (grants de columna).
- Las notas administrativas viven en `owner_clinic_relationships` de cada clínica:
  aisladas por diseño y por política.

## Búsqueda y listado

Server-side, con RLS, término escapado (`escaparBusqueda`), paginación de 20 e índices
sobre `email`, `phone` y `(lower(first_name), lower(last_name))`. Sin trigramas por ahora
(volúmenes de clínica no lo ameritan; decisión documentada en testing.md).
