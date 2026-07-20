# Privacidad del expediente clínico

Principio: los datos clínicos son los más sensibles del producto; el acceso se decide en
PostgreSQL (RLS + funciones), nunca solo en la UI.

## Quién ve qué

- **Recepción**: ve la **cabecera** (`clinical_encounters`: folio, paciente, estado,
  tiempos) para operar la sala de espera, pero RLS le oculta TODAS las tablas hijas
  (nota, exploración, vitales, diagnósticos, tratamientos, archivos, adendas). La UI
  tolera contenido vacío y muestra el aviso de contenido restringido.
- **Veterinarios**: ciclo completo (capturar, diagnosticar, finalizar la propia).
- **Asistentes**: ven contenido clínico y **capturan vitales** (`can_record_vitals`);
  no diagnostican, no editan nota, no finalizan.
- **Administración** (clinic_admin / org admin): ve contenido; NO edita contenido clínico
  salvo que además tenga rol veterinario; la anulación es de administración de la
  organización.
- Otra clínica u otra organización: nada (aislamiento probado en pgTAP).

## Auditoría redactada

Los triggers de auditoría clínica escriben en `audit_log` **solo ids, sección, acción y
actor** — nunca el contenido clínico (no se duplica dato sensible en el log). Los accesos
sensibles (impresión, descarga de archivo, visualización) se registran vía
`log_clinical_record_access('print' | 'file_download' | 'record_view')`.

Matriz completa por rol: `docs/security/roles-and-permissions.md` §11.
