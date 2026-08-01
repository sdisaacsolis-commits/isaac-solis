# Vacunación — Cartilla

`/app/mascotas/[id]/vacunacion` — la cartilla se **consolida dinámicamente desde los
eventos inmutables** (`vaccination_records`); no existe un documento "cartilla" congelado.
Los comprobantes individuales de aplicaciones en clínica sí se congelan
(`vaccination_documents`, ver docs/prescriptions/documents.md para el diseño de hash).

## Contenido

Cabecera: mascota, especie, fecha de nacimiento, propietario principal. Por evento: fecha
de aplicación, nombre de la vacuna (snapshot), enfermedades cubiertas, fabricante, lote,
caducidad, veterinario (aplicaciones en clínica), clínica, próxima dosis confirmada,
**fuente** y **estado**.

## Distinción visual obligatoria

- **Aplicada en esta clínica** (verificada por Dogtoralia).
- **Registro histórico aportado** (dato del propietario, no verificado).
- **Aplicada por tercero** / campaña / importación.
- **Anulada** (visible, contenido conservado).
- **Próxima** dosis pendiente.

Sin recomendaciones automáticas: la cartilla informa, no prescribe.

## Filtros

Año, estado, fuente, vacuna y "solo próximas dosis"; paginación como el expediente.

## Impresión

- Comprobante individual: `/app/vacunacion/[id]/imprimir` — desde el contenido congelado
  cuando existe (aplicaciones en clínica, con hash visible); los históricos se imprimen
  desde el registro con su etiqueta de fuente, sin presentarse como certificación.
- Cartilla completa: `/app/mascotas/[id]/vacunacion/imprimir` — consolida exclusivamente
  eventos accesibles para la clínica activa (RLS: jamás datos de otra organización).
- Ambas vistas registran el acceso en `audit_log` (`log_vaccination_access`).
