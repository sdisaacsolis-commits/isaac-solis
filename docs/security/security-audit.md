# Auditoría de seguridad interna — Dogtoralia (Fase 12)

> Revisión interna de endurecimiento previa a la beta con clínicas reales.
> Fecha: 2026-07-29. Alcance: capa de datos (RLS/autorización), confinamiento de
> secretos, almacenamiento, inmutabilidad clínica y manejo de configuración.
> **Conclusión: sin hallazgos críticos.**
>
> Fuente de verdad operativa: migraciones `supabase/migrations/`, pruebas
> `supabase/tests/database/` y `apps/web/src/env.ts`. Si este documento
> contradice al código, gana el código y se corrige el documento.

## 1. Aislamiento y políticas RLS

- **Toda tabla del esquema `public` tiene RLS habilitado y forzado**
  (`ENABLE` + `FORCE ROW LEVEL SECURITY`) con políticas explícitas por operación
  (`SELECT`/`INSERT`/`UPDATE`), nunca una política genérica `FOR ALL`.
- Modelo detallado en [`docs/security/rls-model.md`](./rls-model.md) y
  [`docs/security/roles-and-permissions.md`](./roles-and-permissions.md).
- **Validación automatizada**: la suite pgTAP
  `supabase/tests/database/18_auditoria_seguridad.sql` recorre el catálogo y
  falla si aparece cualquier tabla de `public` sin RLS forzado o sin política.
  El total del proyecto es de **573 aserciones pgTAP** (suites 01–18).
- Aislamiento entre clínicas (clínica A no ve datos de clínica B) verificado por
  las suites de tenancy; es requisito de salida y bloquea la fusión si falla.

## 2. La autorización se decide en la base de datos

- Toda decisión de acceso vive en RLS y en funciones `SECURITY DEFINER` con
  `search_path` fijo. La UI solo oculta opciones; nunca es la única barrera
  (CLAUDE.md §4).
- Las escrituras con invariantes (agendar cita, cerrar consulta, emitir receta)
  se implementan como funciones SQL/Edge Functions, no como inserts directos del
  cliente. El superadmin no «brinca» RLS: tiene políticas explícitas y auditables.
- `GRANT` a nivel de tabla y de columna como tercera capa de defensa (columnas
  sensibles como `is_superadmin` o `token_hash` quedan fuera del alcance de
  clientes aunque una política fallara).

## 3. Confinamiento de `service_role`

- La `service_role key` (BYPASSRLS) **solo puede aparecer en Edge Functions y
  CI**; jamás en `apps/web`, `apps/mobile` ni en nada que llegue a un cliente
  (CLAUDE.md §2).
- `apps/web/src/env.ts` declara `SUPABASE_SERVICE_ROLE_KEY` únicamente en el
  bloque `server` de `@t3-oss/env-nextjs`: si un componente de cliente intenta
  leerla, se lanza un error en tiempo de ejecución.
- El escaneo de secretos de CI (`.github/`) refuerza que ningún secreto ni la
  `service_role` se filtren al bundle del navegador.
- Autenticación web siempre vía `@supabase/ssr` (cookies del SDK); prohibido
  guardar tokens a mano.

## 4. Almacenamiento (Storage)

- Buckets privados por defecto; el acceso a archivos (p. ej. adjuntos clínicos)
  se hace mediante **URL firmada de corta duración**, nunca URLs públicas
  persistentes (CLAUDE.md §5).

## 5. Inmutabilidad de datos clínicos

- Los datos clínicos no se eliminan: consultas cerradas y recetas emitidas son
  inmutables; las correcciones se hacen mediante adendas (CLAUDE.md §6).
- Operaciones sensibles quedan registradas en `audit_log`, que tiene revocados
  `UPDATE`/`DELETE` incluso para `service_role`: la bitácora no se edita.

## 6. Manejo de secretos y configuración

- Ningún secreto se commitea; todo va en variables de entorno. `.env.example`
  se mantiene actualizado con nombres y descripción **sin valores** (CLAUDE.md §1).
- Variables marcadas como `[PÚBLICA]` (`NEXT_PUBLIC_`) o `[PRIVADA]` (solo
  servidor); la validación Zod en `env.ts` impide que una privada llegue al
  cliente.

## 7. Validación de entrada

- Todo dato externo (formularios, params, payloads, webhooks) se valida con Zod
  en la frontera antes de usarse; los esquemas viven en `packages/validation`
  (es-MX, reutilizados, no duplicados).

## Hallazgos y acciones

| #   | Severidad | Hallazgo                                                | Estado |
| --- | --------- | ------------------------------------------------------- | ------ |
| —   | —         | Sin hallazgos críticos ni altos en el alcance revisado. | ✅     |

Observaciones menores de mejora continua (no bloqueantes para beta):

- Revalorar la rotación periódica de la `service_role key` al pasar de beta a
  producción con cobros.
- Al activar integraciones externas (WhatsApp, pagos reales), mantener la
  interfaz de proveedor desacoplada (ARCHITECTURE.md §6.1) y auditar sus
  secretos con el mismo estándar.

## Conclusión

El sistema cumple los controles de seguridad innegociables (CLAUDE.md §1–6). El
aislamiento entre clínicas está validado automáticamente por pgTAP (suite 18,
573 aserciones totales). **No se detectaron hallazgos críticos**; el proyecto es
apto para operar la beta con 1–3 clínicas reales.
