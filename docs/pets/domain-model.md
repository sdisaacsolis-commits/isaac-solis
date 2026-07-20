# Modelo de dominio de pacientes

> Fase 4. Fuente de verdad: migraciones `supabase/migrations/202607193000*` y pruebas
> `supabase/tests/database/07-08`.

## Separación obligatoria

```
pet_owners (identidad global)
    ↕ pet_owner_relationships (tipo, principal, portal, estado)
pets (identidad global, estable entre clínicas)
    ↕ clinic_pet_relationships (número interno, notas, fuente, estado)
clinics
    ↕ owner_clinic_relationships (cartera de clientes, notas por clínica)
pet_owners
```

- **La mascota NO tiene `clinic_id`**: su identidad sobrevive a cambios de clínica.
- Puede tener **varios propietarios** (tipos: owner/guardian/family_member/
  temporary_caregiver/other) con **exactamente un contacto principal activo**
  (índice único parcial `pet_owner_relationships_un_principal`).
- Puede ser atendida por **varias clínicas**; cada relación clínica–mascota es privada de
  su clínica (número interno, notas administrativas, fuente, fechas).
- Una clínica **solo** ve una mascota con relación `active`; `archived/inactive/blocked/
transferred` no otorgan acceso (probado).
- La relación propietario–clínica NO da acceso a todas las mascotas del propietario: cada
  mascota exige su propia relación con la clínica.

## Datos globales vs datos de clínica

| Globales (compartibles con autorización)                                                                           | Por clínica (jamás visibles a otra clínica)                                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| nombre, especie, raza, sexo, nacimiento (exacto o aproximado), color, señas, microchip, esterilización, fotografía | número interno de paciente, notas administrativas, alertas, fechas de relación, fuente de captación, estado interno, número de cliente |

## Enums

`pet_species` (dog/cat/other), `pet_sex` (male/female/unknown),
`owner_pet_relationship_type`, `owner_pet_relationship_status`
(active/inactive/disputed/revoked), `clinic_pet_status`
(active/inactive/transferred/blocked/archived), `clinic_pet_source`
(manual/owner_registration/invitation/referral/import), `pet_alert_type`,
`pet_alert_severity`, `contact_method`, `consent_type`, `consent_medium`.

## Reglas duras en base de datos

- Microchip normalizado (mayúsculas, sin separadores) y ÚNICO entre registros activos.
- Edad NUNCA almacenada: se calcula en presentación (`calcularEdad`).
- Relaciones históricas no se borran físicamente (status + `deleted_at`).
- `require_clinic_in_organization`: toda relación clínica-* valida coherencia org/clínica.
- Todas las escrituras multi-fila pasan por RPCs transaccionales (rollback probado).

## Preparación para el portal del propietario (fase futura)

`pet_owners.user_id` (nullable) + `pet_owner_relationships.can_access_portal`. La
vinculación registro↔usuario requerirá verificación explícita (invitación + reclamo);
NUNCA se vincula automáticamente por coincidencia de correo. Una relación `revoked` no
concede acceso futuro (probado).
