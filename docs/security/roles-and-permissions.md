# Roles y permisos de Dogtoralia

> Fase 2. Complementa a `docs/security/rls-model.md` (mecánica) con la vista de producto
> (quién puede hacer qué).

## 1. Niveles de rol

| Nivel        | Rol                                   | Descripción                                                                                                                                                 |
| ------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plataforma   | superadmin (`profiles.is_superadmin`) | Personal de Dogtoralia. Lectura global explícita; escrituras administrativas solo vía backend auditado.                                                     |
| Organización | `owner`                               | Propietario del negocio. Administra la organización, sus miembros (incluidos owners) y sus clínicas. Toda organización conserva ≥ 1 owner activo (trigger). |
| Organización | `admin`                               | Administra miembros (excepto owners) y clínicas. No puede crear ni tocar owners.                                                                            |
| Organización | `billing`                             | Reservado para facturación (Fase 11). Hoy: solo lectura de su organización.                                                                                 |
| Organización | `member`                              | Pertenencia base (todo el personal de clínicas la tiene). Solo lectura de su organización.                                                                  |
| Clínica      | `clinic_admin`                        | Administra SU clínica: datos operativos, membresías e invitaciones.                                                                                         |
| Clínica      | `veterinarian`                        | Rol operativo (expedientes en Fase 6). Hoy: lectura de su clínica y colegas.                                                                                |
| Clínica      | `receptionist`                        | Rol operativo (agenda en Fase 5). Hoy: lectura de su clínica.                                                                                               |
| Clínica      | `assistant`                           | Rol operativo de apoyo. Hoy: lectura de su clínica.                                                                                                         |

Estados de membresía (`invited`/`active`/`suspended`/`removed`): solo `active` otorga
acceso. Una membresía `suspended` conserva visibilidad de su propia fila (para saber su
estado) pero pierde todo acceso operativo.

## 2. Matriz de permisos (Fase 2)

✔ = permitido · ✖ = denegado por RLS/privilegios · B = solo backend (service_role)

| Acción                                    | superadmin  | org owner                         | org admin | org member/billing              | clinic_admin    | vet/recep/asist | propietario de mascota* |
| ----------------------------------------- | ----------- | --------------------------------- | --------- | ------------------------------- | --------------- | --------------- | ----------------------- |
| Ver su propio perfil                      | ✔           | ✔                                 | ✔         | ✔                               | ✔               | ✔               | ✔                       |
| Ver perfil básico de colegas (vista)      | ✔           | ✔ su org                          | ✔ su org  | ✔ su org                        | ✔ su org        | ✔ su org        | ✖                       |
| Ver todos los perfiles                    | ✔ (lectura) | ✖                                 | ✖         | ✖                               | ✖               | ✖               | ✖                       |
| Crear organización (RPC)                  | ✔           | ✔ (cualquier usuario autenticado) | ✔         | ✔                               | ✔               | ✔               | ✔                       |
| Editar datos de la organización           | B           | ✔                                 | ✖         | ✖                               | ✖               | ✖               | ✖                       |
| Cambiar plan/estado de organización       | B           | ✖                                 | ✖         | ✖                               | ✖               | ✖               | ✖                       |
| Ver miembros de su organización           | ✔           | ✔                                 | ✔         | ✔                               | ✔ (como member) | ✔ (como member) | ✖                       |
| Agregar/editar owners                     | B           | ✔                                 | ✖         | ✖                               | ✖               | ✖               | ✖                       |
| Agregar/editar admin/billing/member       | B           | ✔                                 | ✔         | ✖                               | ✖               | ✖               | ✖                       |
| Crear clínicas                            | B           | ✔                                 | ✔         | ✖                               | ✖               | ✖               | ✖                       |
| Ver clínicas de su organización           | ✔           | ✔                                 | ✔         | ✖ (solo las suyas como miembro) | ✔ (la suya)     | ✔ (la suya)     | ✖                       |
| Editar datos de una clínica               | B           | ✔                                 | ✔         | ✖                               | ✔ (la suya)     | ✖               | ✖                       |
| Cambiar estado (ciclo de vida) de clínica | B           | ✖                                 | ✖         | ✖                               | ✖               | ✖               | ✖                       |
| Gestionar miembros de clínica             | B           | ✔                                 | ✔         | ✖                               | ✔ (la suya)     | ✖               | ✖                       |
| Invitar personal (RPC)                    | B           | ✔                                 | ✔         | ✖                               | ✔ (la suya)     | ✖               | ✖                       |
| Ver/revocar invitaciones                  | ✔ (ver)     | ✔                                 | ✔         | ✖                               | ✔ (la suya)     | ✖               | ✖                       |
| Leer token_hash de invitaciones           | ✖           | ✖                                 | ✖         | ✖                               | ✖               | ✖               | ✖                       |
| Ver bitácora (audit_log)                  | ✔ global    | ✔ su org                          | ✔ su org  | ✖                               | ✖               | ✖               | ✖                       |
| Editar/borrar bitácora                    | ✖ (nadie)   | ✖                                 | ✖         | ✖                               | ✖               | ✖               | ✖                       |
| Hacerse superadmin                        | ✖           | ✖                                 | ✖         | ✖                               | ✖               | ✖               | ✖                       |

\* Los propietarios de mascotas llegan en la Fase 4; hoy son usuarios sin membresías y no
ven ningún dato de tenancy (probado en pgTAP).

## 3. Reglas anti-elevación

1. Nadie puede otorgarse un rol superior al propio: los admins de organización no crean
   ni editan owners (políticas separadas con `role <> 'owner'` en `USING` y `WITH CHECK`).
2. Los roles operativos de clínica no tienen NINGUNA política de escritura sobre
   membresías: un veterinario no puede elevarse ni una recepcionista cambiar roles.
3. `is_superadmin` está fuera del `GRANT` de columnas, protegido por trigger y auditado.
4. El último owner activo de una organización no puede degradarse, suspenderse,
   removerse ni borrarse (trigger transaccional).

## 4. Cómo se prueba

Cada regla tiene una aserción pgTAP en `supabase/tests/database/` con fixtures de dos
organizaciones, dos clínicas y los nueve perfiles requeridos (superadmin, dos owners,
admin de clínica, veterinario, recepcionista, suspendida, usuario sin membresías y
usuaria invitada). `pnpm db:test` (Supabase CLI) o `pnpm db:test:pg` (PostgreSQL local).

## 5. Matriz del dominio de pacientes (Fase 4)

✔ = permitido · ✖ = denegado por RLS/privilegios · B = solo backend

| Acción                                           | org owner/admin | clinic_admin | veterinario       | recepcionista | asistente        | sin membresía |
| ------------------------------------------------ | --------------- | ------------ | ----------------- | ------------- | ---------------- | ------------- |
| Consultar propietarios/mascotas de sus clínicas  | ✔               | ✔            | ✔                 | ✔             | ✔ (solo lectura) | ✖             |
| Registrar/editar propietarios (RPC + update)     | ✔               | ✔            | ✖ (solo consulta) | ✔             | ✖                | ✖             |
| Registrar mascotas (RPC transaccional)           | ✔               | ✔            | ✔                 | ✔             | ✖                | ✖             |
| Editar datos globales de mascota                 | ✔               | ✔            | ✔                 | ✔             | ✖                | ✖             |
| Añadir propietario / transferir principal (RPCs) | ✔               | ✔            | ✔                 | ✔             | ✖                | ✖             |
| Vincular mascota a clínica del alcance (RPC)     | ✔               | ✔            | ✔                 | ✔             | ✖                | ✖             |
| Archivar relación clínica–mascota                | ✔               | ✔            | ✔                 | ✔             | ✖                | ✖             |
| Crear/resolver alertas administrativas           | ✔               | ✔            | ✔                 | ✔             | ✖                | ✖             |
| Registrar/revocar consentimientos                | ✔               | ✔            | ✖                 | ✔             | ✖                | ✖             |
| Subir/reemplazar fotografía                      | ✔               | ✔            | ✔                 | ✔             | ✖                | ✖             |
| Leer notas/número interno de OTRA clínica        | ✖               | ✖            | ✖                 | ✖             | ✖                | ✖             |
| Borrado físico / deceased_at / deleted_at        | B               | B            | B                 | B             | B                | ✖             |

Ajustes documentados respecto a la propuesta inicial: los veterinarios SÍ editan datos
básicos de mascotas y crean alertas de manejo (operación clínica cotidiana), pero NO
gestionan propietarios ni consentimientos; los asistentes son estrictamente de lectura en
esta fase. La autoridad sigue siendo PostgreSQL (funciones `can_access_*`/`can_manage_*`).

## 10. Matriz del dominio de agenda (Fase 5)

La matriz completa de permisos de agenda (catálogo, horarios, citas,
transiciones y outbox) vive en
[`docs/appointments/rls-and-permissions.md`](../appointments/rls-and-permissions.md).
Resumen: el personal operativo (administración, veterinarios, recepción)
agenda y gestiona citas; iniciar/completar la atención es acto clínico
(veterinario o administración); el personal asistente solo consulta; la
configuración de catálogo y horarios es de administración. Todas las
escrituras con invariantes son RPCs SECURITY DEFINER.

## 11. Matriz del dominio clínico (Fase 6)

✔ = permitido · ✖ = denegado por RLS/privilegios

| Acción                                      | org owner/admin   | clinic_admin      | veterinario        | recepcionista  | asistente | sin membresía |
| ------------------------------------------- | ----------------- | ----------------- | ------------------ | -------------- | --------- | ------------- |
| Ver cabecera de consultas (folio/estado)    | ✔                 | ✔                 | ✔                  | ✔              | ✔         | ✖             |
| Ver contenido clínico (nota, dx, vitales…)  | ✔                 | ✔                 | ✔                  | ✖              | ✔         | ✖             |
| Abrir consulta desde cita / walk-in (RPCs)  | ✔                 | ✔                 | ✔                  | ✔ (vía agenda) | ✖         | ✖             |
| Editar contenido clínico (consulta abierta) | ✖ (salvo rol vet) | ✖ (salvo rol vet) | ✔                  | ✖              | ✖         | ✖             |
| Capturar signos vitales                     | ✖ (salvo rol vet) | ✖ (salvo rol vet) | ✔                  | ✖              | ✔         | ✖             |
| Registrar diagnósticos/tratamientos         | ✖ (salvo rol vet) | ✖ (salvo rol vet) | ✔                  | ✖              | ✖         | ✖             |
| Subir archivos clínicos                     | ✔ (clinic_admin)  | ✔                 | ✔                  | ✖              | ✖         | ✖             |
| Finalizar consulta (firma clínica)          | ✖ (salvo rol vet) | ✖ (salvo rol vet) | ✔ (la responsable) | ✖              | ✖         | ✖             |
| Crear adendas (solo finalizadas)            | ✖ (salvo rol vet) | ✖ (salvo rol vet) | ✔                  | ✖              | ✖         | ✖             |
| Editar contenido de consulta finalizada     | ✖ (nadie)         | ✖                 | ✖                  | ✖              | ✖         | ✖             |
| Anular consulta (motivo obligatorio)        | ✔                 | ✖                 | ✖                  | ✖              | ✖         | ✖             |
| Imprimir/descargar (queda en bitácora)      | ✔                 | ✔                 | ✔                  | ✖              | ✔         | ✖             |

Notas: la recepción opera la sala de espera con la cabecera y registra walk-ins vía la
agenda, sin ver jamás contenido clínico; el asistente ve contenido y captura vitales pero
no diagnostica ni finaliza; finalizar y editar contenido son actos clínicos que exigen rol
`veterinarian` aunque se tenga administración. La anulación conserva el contenido intacto y
no reutiliza el folio. Detalle y auditoría redactada: ver
[`docs/clinical/privacy.md`](../clinical/privacy.md).
