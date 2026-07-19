# Privacidad y consentimientos

> Fase 4. Tabla `owner_consents` + reglas de alcance de datos.

## Consentimientos versionados

Nunca un booleano suelto: cada consentimiento registra tipo (`privacy_notice`,
`data_processing`, `communications`, `clinic_access`, `share_records`, `portal_terms`),
**versión del documento**, fecha, medio (`in_person`/`web`/`email`/`phone`), actor que lo
recabó, metadata no sensible y revocación (fecha + actor). Sin DELETE para clientes
(probado); solo revocación por columnas limitadas.

Hoy la UI recaba el aviso de privacidad en el alta de propietario (versión `v1.0-2026`).
Los demás tipos se irán usando en el portal y la compartición de expedientes.

## Alcance de datos (resumen)

- `pet_owners` NO está abierto a cualquier autenticado: `can_access_owner` exige relación
  con una clínica del actor o con una mascota accesible.
- Notas administrativas de propietarios y mascotas viven en las RELACIONES por clínica:
  otra clínica no puede leerlas (política + pruebas).
- Las coincidencias de duplicados solo muestran registros que el actor ya puede ver.
- La detección de intentos rechazados relevante queda en `audit_log` (triggers) y en los
  errores 42501 de las RPCs; el registro operativo de rechazos con contexto HTTP llegará
  con Edge Functions.

## LFPDPPP / ARCO

El diseño conserva: identidad global del titular, consentimientos versionados con
evidencia, borrado lógico y auditoría. La exportación ARCO y la anonimización siguen
planificadas post-MVP (PRD §7.5 y backlog).
