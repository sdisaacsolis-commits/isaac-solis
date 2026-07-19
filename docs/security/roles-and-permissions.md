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
