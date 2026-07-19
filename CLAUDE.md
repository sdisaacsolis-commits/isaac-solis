# CLAUDE.md — Reglas del proyecto Dogtoralia

Reglas obligatorias para todo el desarrollo de este repositorio. Ante conflicto, el orden de
autoridad es: instrucciones directas del usuario > este archivo > preferencias generales.

## Contexto

Dogtoralia es un SaaS multi-clínica veterinaria (México). Maneja **datos personales y datos
clínicos**: la seguridad y el aislamiento entre clínicas son innegociables. Documentos rectores:
`PRODUCT_REQUIREMENTS.md`, `ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `ROADMAP.md`.

## Reglas de seguridad (innegociables)

1. **Nunca** commitear credenciales, llaves, tokens ni secretos. Todo secreto va en variables
   de entorno; `.env.example` se mantiene actualizado con nombres y descripción, sin valores.
2. La `service_role key` de Supabase solo puede aparecer en Edge Functions y CI. Jamás en
   `apps/web`, `apps/mobile` ni en nada que llegue a un cliente.
3. **Toda tabla nueva del esquema `public` se crea con RLS habilitado y forzado**, con políticas
   explícitas y con una prueba de aislamiento (clínica A no ve datos de clínica B) antes de
   fusionar. Sin excepciones.
4. La autorización se decide en la base de datos (RLS/funciones SQL). La UI puede ocultar
   opciones, pero nunca es la única barrera.
5. Buckets de Storage privados por defecto; acceso mediante URL firmada de corta duración.
6. Los datos clínicos no se eliminan: consultas cerradas y recetas emitidas son inmutables;
   correcciones mediante adendas. Operaciones sensibles registran en `audit_log`.

## Reglas de código

7. TypeScript en modo `strict` (además `noUncheckedIndexedAccess`). Prohibido `any` salvo
   justificación comentada; preferir `unknown` + narrowing.
8. Todo dato externo (formularios, params, payloads, webhooks) se valida con Zod en la frontera
   antes de usarse. Los esquemas viven en `packages/validation` y se reutilizan — no se duplican.
9. Manejo de errores explícito: nada de `catch` vacíos ni errores silenciados. Errores de
   dominio con código estable; mensajes al usuario en español claro sin detalles internos.
10. Evitar duplicación: tipos en `packages/types`, esquemas en `packages/validation`,
    componentes UI reutilizables en `packages/ui` (los específicos de una pantalla viven en
    `apps/web/src/components`). Antes de crear algo, buscar si ya existe.
11. Nombres claros y consistentes: tablas/columnas en inglés `snake_case`; componentes React en
    `PascalCase`; archivos de features en `kebab-case`; funciones con verbo
    (`bookAppointment`, `issuePrescription`).
12. Textos de UI en español de México, siempre a través de la capa de i18n (nunca cadenas
    sueltas en JSX), para permitir más idiomas después.
13. Fechas: almacenar `timestamptz` (UTC); convertir a `America/Mexico_City` solo en
    presentación. Dinero: enteros en centavos, MXN.
14. Accesibilidad: componentes interactivos con etiquetas y navegación por teclado (base
    Radix/shadcn); no romper semántica HTML.

## Reglas de base de datos

15. Todo cambio de esquema es una migración SQL versionada en `supabase/migrations/` (nunca
    cambios manuales). Las migraciones son inmutables una vez fusionadas: los ajustes van en
    una migración nueva.
16. Toda tabla lleva `created_at`/`updated_at`; tablas de datos de clínica llevan `clinic_id`.
    Integridad en la BD (`NOT NULL`, `CHECK`, `UNIQUE`, FK, `EXCLUDE`), no solo en la app.
17. Escrituras con invariantes (agendar cita, cerrar consulta, emitir receta) se implementan
    como funciones SQL o Edge Functions, no como inserts directos del cliente.
18. Después de cambiar el esquema, regenerar los tipos TS (`packages/types`, comando
    `pnpm db:types`) en el mismo PR.
    18b. Integraciones externas (correo, push, WhatsApp, pagos) siempre detrás de una interfaz de
    proveedor desacoplada (ARCHITECTURE.md §6.1); el dominio nunca importa SDKs de proveedores
    directamente. Proveedor previsto para WhatsApp: Meta WhatsApp Cloud API (fase posterior).

## Reglas de pruebas

19. Ninguna fase del ROADMAP se da por terminada sin sus pruebas en verde ni sin cumplir sus
    criterios de salida.
20. Prioridad de cobertura: (1) pruebas de RLS/aislamiento, (2) lógica de dominio (agenda,
    estados de cita, inmutabilidad), (3) validación Zod, (4) E2E de flujos críticos.
21. CI (lint + typecheck + pruebas + migraciones contra Postgres efímero) debe pasar antes de
    fusionar.

## Reglas de proceso

22. No instalar dependencias que no se necesiten para la fase en curso. Justificar cada
    dependencia nueva no trivial.
23. No construir funcionalidades fuera del alcance documentado; toda idea nueva se marca como
    **[Propuesta]** en la documentación y se aprueba antes de implementarse.
24. Commits pequeños con mensajes descriptivos en español o inglés consistente
    (`feat: agenda — restricción anti-traslape`). Trabajar en ramas; no push directo a `main`.
25. Mantener la documentación sincronizada: si una decisión cambia, actualizar el documento
    rector correspondiente en el mismo PR.
26. Decisiones de arquitectura relevantes se registran como ADR en `docs/adr/` (contexto,
    decisión, consecuencias).

## Comandos de referencia

```bash
pnpm dev           # panel web local (http://localhost:3000)
pnpm build         # build de producción
pnpm lint          # ESLint (flat config raíz) en todos los paquetes
pnpm format:check  # Prettier en modo verificación (format para corregir)
pnpm typecheck     # tsc --noEmit en todos los paquetes
pnpm test          # pruebas unitarias (Vitest, desde la raíz)
pnpm test:e2e      # Playwright (levanta next dev solo; PLAYWRIGHT_CHROMIUM_PATH opcional)
pnpm db:start      # Supabase local (requiere Docker)
pnpm db:reset      # aplica migraciones + seed
pnpm db:test       # pruebas pgTAP vía Supabase CLI (supabase/tests/database/)
pnpm db:test:pg    # pruebas pgTAP sin Docker (PostgreSQL 16 + scripts/db/supabase-shim.sql)
pnpm db:types      # regenera packages/types/src/database.types.ts
```

Notas de entorno:

- Los postinstalls permitidos se controlan con `pnpm.onlyBuiltDependencies` (package.json);
  no aprobar builds de dependencias nuevas sin revisarlas.
- No se usa Husky/lint-staged: la verificación vive en CI y en los comandos anteriores, para
  no complicar entornos remotos/sandbox. Revalorar cuando el equipo crezca.
- Autenticación: siempre `@supabase/ssr` (cookies del SDK); prohibido guardar tokens a mano
  o usar la service_role en `apps/web`. Flujos y URLs de redirección: `docs/auth/`.
- Los flujos E2E completos de auth requieren Supabase local y `E2E_AUTH=1`
  (`docs/testing/auth-e2e.md`); las suites básicas corren sin Supabase.
