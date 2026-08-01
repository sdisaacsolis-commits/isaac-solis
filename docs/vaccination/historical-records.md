# Vacunación — Registros históricos aportados

Flujo **separado y auditado** (`record_historical_vaccination`) para vacunas que la clínica
no aplicó: cartillas físicas del propietario, aplicaciones de terceros, campañas e
importaciones. **Nunca se presentan como aplicaciones verificadas por Dogtoralia.**

## Reglas

- Fuentes admitidas: `historical_owner_document`, `external_clinic`, `campaign`, `import`.
  La fuente `administered_in_clinic` se **rechaza** aquí (`FUENTE_INVALIDA`): las
  aplicaciones en clínica tienen su propio flujo con requisitos más estrictos.
- Roles autorizados: administración de clínica, veterinarios y **recepción** (matriz de
  permisos). Los asistentes no registran históricos.
- Se solicita: nombre de la vacuna (obligatorio), **fecha de aplicación pasada**
  (`FECHA_INVALIDA` si es futura o falta), clínica/profesional externo si se conoce
  (`historical_provider_name`), lote y caducidad **si están disponibles**, referencia del
  documento y comprobante opcional (foto/PDF), notas.
- `created_by` conserva quién capturó; la fuente y la leyenda en UI dejan claro que el
  dato **fue aportado por el propietario** (o tercero).
- **Próxima dosis**: es decisión clínica — si quien registra no es veterinario, la RPC la
  rechaza (`PROXIMA_DOSIS_SOLO_VETERINARIO`). Recepción registra el histórico y un
  veterinario confirma la próxima dosis después si procede.
- Idempotencia por `client_request_id`, igual que las aplicaciones.
- `administered_at` se ancla a mediodía local de la clínica para la fecha aportada (evita
  el corrimiento de día por zona horaria).

## Comprobante adjunto

Bucket privado `vaccination-files`, ruta generada en servidor
`pets/{petId}/vaccinations/{uuid}.{ext}`, MIME verificado por **contenido real** (magic
bytes; PDF/JPEG/PNG/WebP, sin SVG/HTML/JS), tamaño máximo `CLINICAL_FILE_MAX_MB`, descarga
solo con URL firmada corta y acceso registrado (`log_vaccination_access`). Las políticas de
Storage exigen membresía activa en una clínica con relación vigente con la mascota; suben
solo los roles que registran históricos.

## Presentación

En cartilla, detalle y documentos se distingue SIEMPRE: **"Aplicada en esta clínica"**,
**"Registro histórico aportado"**, **"Aplicada por tercero"**, campaña e importación — y el
estado "Anulada". Un registro histórico no genera comprobante congelado de Dogtoralia (no
certificamos lo que no aplicamos); su documento aportado se conserva tal cual.
