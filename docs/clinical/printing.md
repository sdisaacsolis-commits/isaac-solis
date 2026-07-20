# Documento clínico imprimible

- Ruta: `/app/consultas/{id}/imprimir`. **Solo consultas finalizadas**: cualquier otro
  estado redirige al detalle (un borrador no es un documento clínico).
- Contenido: encabezado Dogtoralia + datos de la clínica (nombre, teléfono, correo,
  dirección), folio, fechas de inicio y finalización, veterinario responsable, paciente
  (nombre/especie/raza/sexo), propietario, motivo, signos vitales (última medición y
  tabla completa), exploración física, nota SOAP, diagnósticos, tratamientos con
  indicaciones, seguimientos y adendas con autor y fecha.
- **Nunca** incluye `internal_notes` (notas internas del personal) ni datos de otras
  clínicas.
- Presentación: página en blanco print-friendly; con `@media print` se oculta la
  navegación del panel y el botón. El botón «Imprimir» (client component) registra el
  acceso en la bitácora — `log_clinical_record_access('print')`, mejor esfuerzo — y llama
  `window.print()`.
- Fechas en la zona horaria de la clínica (`America/Mexico_City` por defecto), formato
  es-MX.
- La receta formal con PDF generado en servidor llega en la Fase 7; este documento es el
  resumen clínico de la consulta.
