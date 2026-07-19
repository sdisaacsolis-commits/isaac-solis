# Gestión de mascotas

> Fase 4. Rutas: `/app/mascotas`, `/app/mascotas/nueva`, `/app/mascotas/[id]`,
> `/app/mascotas/[id]/editar`.

## Alta (RPC `register_pet_with_relationships`)

Transaccional (rollback total probado en pgTAP): crea `pets` + relación con el
propietario principal (`is_primary = true`) + relación con la clínica (`active`, fuente,
número interno, `first_visit_at`). Autorizados: personal operativo (clinic_admin,
veterinario, recepción) y admins de organización; asistentes solo consultan.

Duplicados: antes de crear se busca por microchip (prioritario), y por
nombre+especie(+propietario) dentro del alcance RLS. La UI advierte y permite **usar el
registro existente** (lo vincula a la clínica vía `link_pet_to_clinic`) o **crear de
todos modos**.

## Propietarios múltiples

- `add_pet_owner`: añade relaciones adicionales (sin tocar al principal; duplicados
  bloqueados).
- `set_primary_pet_owner`: transferencia transaccional del contacto principal —
  siempre EXACTAMENTE un principal activo (índice único parcial + RPC; `is_primary` no
  es editable directamente por clientes).

## Vinculación con clínicas

`link_pet_to_clinic`: proceso explícito. El actor debe poder acceder a la mascota por
alguna de SUS clínicas y ser personal operativo de la clínica destino (caso típico:
organizaciones multi-sucursal). El intercambio entre organizaciones ajenas requerirá el
consentimiento del propietario (portal, fase futura) — hoy está bloqueado y probado.
Archivar la relación (`status = 'archived'`) retira el acceso de inmediato sin tocar a la
mascota ni a sus otras clínicas.

## Alertas administrativas

`pet_alerts` (comportamiento agresivo, riesgo de fuga, precaución de manejo, preferencia
de comunicación, nota de cobranza, otra) con severidad info/caution/critical. EXCLUSIVAS
de la clínica que las crea. Crean: personal operativo (incluye veterinarios); asistentes
no. NO son datos clínicos: diagnósticos y alergias llegarán con el expediente (Fase 6).

## Edición

Datos globales de la mascota: `can_manage_pet` con grants de columna. La edad jamás se
guarda; `deceased_at` y el borrado lógico son de backend.
