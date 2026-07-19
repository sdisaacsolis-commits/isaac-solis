# Relaciones clínica–mascota

> Fase 4. La ÚNICA fuente de acceso operativo de una clínica a una mascota.

## Ciclo de vida

`active` → (`inactive` | `blocked` | `transferred` | `archived`). Solo `active` otorga
acceso (todas las funciones de acceso lo exigen). Índice único parcial: una relación
activa por (clínica, mascota). Archivar NO borra la mascota ni afecta a otras clínicas.

## Datos privados por clínica

`internal_patient_number` (único por clínica), `administrative_notes`, `source`,
`first_visit_at`, `last_visit_at`, `referred_by_clinic_id`. La política de SELECT limita
las filas a miembros de ESA clínica (+ admins de su organización + superadmin): una
clínica que comparte la mascota no ve la relación de la otra (probado en pgTAP 07,
caso 4).

## Mascota compartida

Dos clínicas con relación activa ven los MISMOS datos globales de la mascota y cada una
sus propios datos privados. Hoy la compartición nace de: (a) organizaciones
multi-sucursal vía `link_pet_to_clinic`, o (b) procesos de backend (service_role) que en
el futuro representarán el consentimiento del propietario. Entre organizaciones ajenas no
existe autoservicio (bloqueado y probado).

## Auditoría

Todos los cambios de estas relaciones quedan en `audit_log` con `organization_id` y
`clinic_id` poblados (función de auditoría extendida en la migración 0017).
