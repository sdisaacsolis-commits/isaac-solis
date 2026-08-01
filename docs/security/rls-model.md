# Modelo de seguridad RLS de Dogtoralia

> Fase 2. Fuente de verdad operativa: migraciones `supabase/migrations/202607191000*`
> y pruebas `supabase/tests/database/`. Si este documento contradice al SQL, gana el SQL
> y hay que corregir el documento.

## 1. Principios

1. **La base de datos es la frontera de seguridad.** El frontend solo mejora UX; ninguna
   regla depende de él.
2. **RLS habilitado Y forzado** (`ENABLE` + `FORCE ROW LEVEL SECURITY`) en toda tabla de
   `public`. Hay una prueba pgTAP que falla si aparece una tabla sin ambas.
3. **Denegado por defecto.** Sin política y sin `GRANT`, no hay acceso. Las políticas son
   explícitas por operación (`SELECT`/`INSERT`/`UPDATE`), nunca una genérica `FOR ALL`.
4. **Tres capas de defensa** por tabla:
   - `GRANT` de tabla y **de columnas** (p. ej. `is_superadmin`, `clinics.status` y
     `token_hash` quedan fuera del alcance de clientes aunque una política fallara).
   - Políticas RLS con funciones auxiliares.
   - Triggers de invariantes (último owner, pertenencia a organización, máquina de
     estados, protección de superadmin).
5. **El borrado lógico oculta**: las políticas de lectura exigen `deleted_at IS NULL`.
6. **El superadmin no "brinca" RLS**: tiene políticas explícitas y auditables
   (`*_select_superadmin`); su acceso de escritura fuera de su perfil es vía backend.
7. **service_role** (BYPASSRLS) solo existe en backend/Edge Functions; jamás en clientes.
   Aún así, `audit_log` le tiene revocados `UPDATE/DELETE`: la bitácora no se edita.
   Sus privilegios de tabla se otorgan de forma **explícita** por migración
   (`20260719300008_grants_service_role.sql`): en el entorno canónico de Supabase las
   tablas creadas por migraciones no heredan permisos para `service_role`, así que no
   dependemos de default privileges del entorno.

## 2. Jerarquía de tenancy

```
organización (sujeto comercial)
└── clínicas (operación; ciclo de vida trial→active→…→archived)
    └── miembros de clínica (roles operativos)
miembros de organización (roles administrativos)
perfiles (1:1 con auth.users, globales)
```

- Un usuario puede pertenecer a varias organizaciones y clínicas con roles distintos.
- Para ser miembro de una clínica se exige membresía **activa** en la organización dueña
  (trigger `clinic_members_require_org_membership`).
- Miembros `suspended` pierden acceso operativo de inmediato: todas las funciones
  auxiliares exigen `status = 'active'`.

## 3. Funciones auxiliares

Todas `SECURITY DEFINER`, `STABLE`, `set search_path = ''`, sin SQL dinámico, con
`EXECUTE` revocado a `public`/`anon`:

| Función                                       | Devuelve true cuando…                                       |
| --------------------------------------------- | ----------------------------------------------------------- |
| `current_user_is_superadmin()`                | el perfil del actor tiene `is_superadmin` y no está borrado |
| `is_organization_member(org)`                 | membresía activa en la organización                         |
| `is_organization_admin(org)`                  | rol `owner` o `admin` activo                                |
| `is_organization_owner(org)`                  | rol `owner` activo                                          |
| `is_clinic_member(clinic)`                    | membresía activa en la clínica                              |
| `is_clinic_admin(clinic)`                     | rol `clinic_admin` activo                                   |
| `clinic_belongs_to_organization(clinic, org)` | relación de pertenencia                                     |
| `organization_of_clinic(clinic)`              | (uuid) organización dueña                                   |

**Por qué SECURITY DEFINER:** consultan tablas con RLS forzado. Como INVOKER, la política
de la tabla A llamaría funciones que leen la tabla B bajo las políticas del actor
(recursión y resultados según lo que el actor "ve", no la membresía real). Como DEFINER se
ejecutan como el dueño (postgres, con BYPASSRLS en Supabase) y rompen el ciclo. El mismo
razonamiento aplica a los triggers de invariantes que cuentan filas de otras tablas.

## 4. Resumen de políticas por tabla

| Tabla                | SELECT                                                          | INSERT                                | UPDATE                                                         | DELETE   |
| -------------------- | --------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------- | -------- |
| profiles             | propio; superadmin                                              | — (trigger de auth)                   | propio (columnas seguras)                                      | —        |
| reserved_slugs       | autenticados                                                    | —                                     | —                                                              | —        |
| organizations        | miembros; superadmin                                            | — (RPC)                               | owner (name/legal/slug/tax)                                    | —        |
| organization_members | propios + miembros de la org; superadmin                        | owner (todo rol); admin (rol ≠ owner) | owner; admin (sin tocar/crear owners)                          | —        |
| clinics              | miembros de la clínica; admins de la org; superadmin            | admins de la org (nace `trial`)       | admins de org o de la clínica (sin `status`/`organization_id`) | —        |
| clinic_members       | propios + miembros de la clínica + admins de la org; superadmin | admins de org/clínica                 | admins de org/clínica                                          | —        |
| clinic_invitations   | admins de org/clínica; superadmin (sin `token_hash`)            | — (RPC)                               | solo `pending → revoked` por admins                            | —        |
| audit_log            | admins de su org; superadmin                                    | — (trigger)                           | — (revocado incluso a service_role)                            | — (ídem) |

Los "—" significan: sin política **y** sin GRANT ⇒ la operación es del backend
(service_role) o simplemente no existe.

## 5. RPCs transaccionales

| RPC                                                         | Qué garantiza                                                                                                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_organization_with_owner(name, slug?, legal?, rfc?)` | organización + membresía owner en una transacción; nunca una organización sin owner                                                                      |
| `create_clinic_with_admin(org, name, …)` (Fase 3)           | admin de la organización verificado; clínica (`trial`) + membresía `clinic_admin` del creador en una transacción                                         |
| `invite_clinic_member(clinic, email, role)`                 | permisos verificados, correo normalizado, token aleatorio de 256 bits devuelto UNA vez, solo hash SHA-256 persistido, sin duplicados pendientes          |
| `resend_clinic_invitation(invitation_id)` (Fase 3)          | solo admins y solo pendientes; token NUEVO que reemplaza el hash (el enlace anterior se invalida al instante) y extiende vigencia; sin duplicar filas    |
| `accept_clinic_invitation(token)`                           | vigencia + coincidencia de correo verificadas; membresía de organización (`member`) y de clínica creadas y la invitación marcada `accepted`, todo o nada |

### Vista segura `colleague_profiles` (Fase 3)

Expone SOLO `id, display_name, first_name, last_name, avatar_url` de perfiles que
comparten una organización ACTIVA con el actor (o el propio). Es la única vía para ver
colegas: la tabla `profiles` sigue cerrada (propio + superadmin). Sin teléfono, sin
`is_superadmin`, sin locale. Probado en pgTAP 06 que no filtra perfiles de otras
organizaciones.

## 6. Acciones que requieren service_role (backend) — nunca cliente

- Cambiar `is_superadmin`, `clinics.status`, `organizations.status/plan_code/limites`.
- Borrado lógico (`deleted_at`) de organizaciones, clínicas y perfiles; anonimización ARCO.
- Marcar invitaciones vencidas (`expired`), limpiar tokens, reenviar correos.
- Cualquier lectura administrativa transversal (soporte), siempre auditada.

## 7. Casos de aislamiento demostrados por pruebas

Los 12 casos exigidos por producto están cubiertos en
`supabase/tests/database/02–05` (153 aserciones pgTAP): usuario sin membresía (1),
clínica A vs clínica B (2), admin de organización (3), admin de clínica ajeno (4),
recepcionista y roles (5), autoelevación de veterinario (6), auto-superadmin (7),
organización A vs B (8), suspendidos (9), borrado lógico (10), service_role backend (11,
por diseño de BYPASSRLS + revocaciones) y superadmin explícito (12).

## 8. Limitaciones conocidas / pendientes

- ~~Perfiles de colegas invisibles~~ → resuelto en Fase 3 con la vista `colleague_profiles`.
- El correo de los miembros no se muestra en la UI de personal (los correos viven en
  `auth.users`, no expuestos a clientes); se evaluará exponerlo vía vista en fase posterior.
- No hay flujo de "salir de la organización" self-service ni transferencia de propiedad
  (RPC futura `transfer_organization_ownership`).
- La restricción de acceso a clínicas `suspended/cancelled` (a nivel clínica, no
  membresía) se definirá con las políticas de cobranza (Fase 11).
- `ip_address`/`user_agent` de `audit_log` se poblarán desde Edge Functions.

## 9. Extensión de la Fase 4 (dominio de pacientes)

Nuevas funciones de acceso (mismas salvaguardas que §3): `can_access_pet`,
`can_manage_pet`, `can_access_owner`, `can_manage_owner`,
`has_active_clinic_pet_relationship`, `has_active_owner_pet_relationship`,
`pet_belongs_to_accessible_clinic`, `is_clinic_operational_staff` y
`pet_id_from_storage_path` (políticas de Storage). Nunca confían en la clínica enviada
por el cliente: derivan las clínicas del actor desde sus membresías activas.

Principios aplicados a las 7 tablas nuevas: identidad global (pets/pet_owners) accesible
SOLO vía relaciones activas; datos por-clínica (notas, números internos, alertas,
consentimientos) aislados por política; INSERT multi-fila solo vía RPC; `is_primary` sin
GRANT directo (solo la RPC de transferencia); bucket `pet-photos` privado con las mismas
funciones. Detalle completo: `docs/pets/domain-model.md`; pruebas: pgTAP 07-08 (241
aserciones totales).

## 10. Extensión de las Fases 5–7 (agenda, expediente, recetas y vacunación)

Los mismos principios se aplican a los dominios posteriores; cada fase añade sus funciones
auxiliares `SECURITY DEFINER` (`search_path=''`, sin SQL dinámico, organización SIEMPRE
derivada de la clínica) y sus suites pgTAP:

- **Fase 5 (agenda)**: servicios, horarios, citas y outbox de notificaciones aislados por
  clínica; escrituras con invariantes solo por RPCs; suites 09–10.
- **Fase 6 (expediente)**: cabecera administrativa vs. contenido clínico
  (`can_view_clinical_content` excluye a recepción por diseño); inmutabilidad de dos capas
  con GUC transaccional; bucket `clinical-files`; suite 11.
- **Fase 7 (recetas y vacunación)**: `can_view_prescription` (los borradores solo para
  roles clínicos; los documentos emitidos para toda la clínica y la administración de la
  organización), `can_edit_prescription` (solo el prescriptor con borrador vigente),
  `can_view_vaccination_record` (cartilla operativa para el personal activo),
  `can_manage_vaccine_catalog`; escritura de recetas emitidas y registros de vacunación
  IMPOSIBLE para clientes (columnas sin grant + triggers `RECETA_INMUTABLE` /
  `VACUNACION_INMUTABLE` / `DOCUMENTO_INMUTABLE` que bloquean incluso a roles que omiten
  RLS); historial y documentos append-only también para `service_role`; contadores de
  folio inaccesibles; bucket `vaccination-files` con acceso derivado de la relación
  clínica–mascota; auditoría redactada (sin medicamentos, dosis ni lotes en `audit_log`).
  Suite 12 (441 aserciones totales).

## 11. Extensión de la Fase 8 (portal público)

`anon` no recibe ningún grant sobre tablas: la superficie pública son RPCs
`SECURITY DEFINER` curadas que exponen SOLO clínicas `is_public` (helper
`clinic_is_publicly_visible`) y, para reservar, `accepts_online_booking`. El portal del
propietario también es RPC-only (evita fugas por columnas: jamás notas internas ni SOAP).
Tokens de invitación hasheados e ilegibles; `get_available_slots` re-emitida con bypass
GUC transaccional que solo fijan las funciones públicas validadas. Suite 13 (474 totales).
