# Pruebas del dominio de pacientes

> Fase 4.

## pgTAP (autoritativas)

`supabase/tests/database/07_aislamiento_mascotas.sql` y
`08_rpcs_alertas_consentimientos.sql` (70 aserciones nuevas; 241 totales). Fixtures: 2
organizaciones, 3 clínicas (A1, A2, B1), mascota exclusiva de A, exclusiva de B y
compartida, propietarios exclusivos/compartidos (uno vinculado a usuario), relaciones
activas/archivadas/revocadas, roles completos (admin, vet, recepción, asistente,
suspendida) y usuario sin membresías.

Cubren los 23 casos exigidos: aislamiento de mascotas/propietarios/notas/alertas/
consentimientos/fotos, mascota compartida, transaccionalidad y rollback, un solo
principal, microchip y relaciones duplicadas, archivado sin acceso, borrado lógico,
suspendidos, superadmin, service_role, IDs manipulados y anti-elevación de RPCs.

```bash
pnpm db:test:pg    # PostgreSQL local + shim (incluye storage mínimo)
pnpm db:test       # Supabase CLI + Docker (canónico; corre en CI)
```

## Unitarias (Vitest)

Esquemas Zod de pacientes (29 aserciones: nombres, correos/teléfonos, CP, fechas futuras
e incoherentes, aproximadas, microchip, especies/sexos/relaciones inválidas, IDs, límites)
y utilidades web (edad calculada con fecha inyectable, etiquetas es-MX, escape de
búsqueda, validación de MIME/tamaño de fotos, redacción).

## Integración

Las operaciones de negocio (alta transaccional, rollback, segundo propietario, principal,
vinculación/archivo, alertas, consentimientos, auditoría, roles rechazados) se prueban
contra PostgreSQL real en las suites pgTAP 07-08 — esa es la capa de integración del
proyecto (misma estrategia que Fases 2-3).

## E2E (Playwright)

- Sin Supabase (siempre): protección de `/app/propietarios`, `/app/mascotas` y
  `/app/mascotas/nueva`; acceso por URL directa sin sesión.
- Con `E2E_AUTH=1` + Supabase local (`mascotas-flujos.spec.ts`): registro de propietario,
  mascota con fotografía (fixture `e2e/fixtures/mascota.png`), búsqueda por nombre y
  teléfono, segundo propietario, transferencia de principal y alerta administrativa.

## Estrategia de búsqueda

ILIKE + índices btree (nombre normalizado, correo, teléfono, microchip, número interno).
Sin `pg_trgm` todavía: el volumen por clínica (cientos-miles) no lo justifica; se
adoptará si la telemetría de la beta muestra búsquedas lentas. Término escapado
(`escaparBusqueda`) y paginación obligatoria (20 por página, tope de página 500).
