# Recetas — Documento emitido, hash y PDF

## Decisión: datos estructurados como fuente de verdad

Al emitir, `issue_prescription` congela en `prescription_documents.content` una
**representación canónica determinista** del documento (jsonb: folio, fecha de emisión,
snapshots de clínica/prescriptor/mascota/propietario, partidas ordenadas, instrucciones,
vigencia, folio del documento sustituido si aplica, `template_version`). jsonb normaliza el
orden de llaves, por lo que la serialización es estable.

Sobre esa serialización se calcula **SHA-256 en la base de datos** (función interna
`sha256()` de PostgreSQL, sin depender del esquema de pgcrypto) y se guarda en
`prescription_documents.sha256`. El hash aparece en el documento imprimible como
identificador verificable.

**El documento se genera UNA sola vez, al emitir, y jamás se regenera**: la tabla tiene un
trigger que rechaza update/delete sin excepción (`DOCUMENTO_INMUTABLE`) y `UNIQUE
(prescription_id)`.

## Vista imprimible

`/app/recetas/[id]/imprimir` renderiza **exclusivamente desde el snapshot congelado**
(nunca desde datos vivos). Incluye: Dogtoralia, datos de la clínica, folio, fecha y hora de
emisión, veterinario y cédula profesional, mascota (especie, raza, sexo, peso disponible de
la consulta), propietario, partidas con dosis/vía/frecuencia/duración/cantidad capturadas,
indicaciones, vigencia, estado del documento y hash. Excluye: notas internas, auditoría,
diagnósticos no destinados al documento y datos de otras clínicas. Recetas anuladas o
sustituidas muestran marca visible ("ANULADA" / "SUSTITUIDA", con referencia al folio
sustituto). Bloque para **firma autógrafa** con leyenda explícita de que no es firma
digital certificada — no se simula ninguna firma.

Cada impresión se registra en `audit_log` vía `log_prescription_access(id, 'print')`.

## PDF binario congelado — pendiente documentado

Este entorno no justifica añadir un motor de PDF pesado (CLAUDE.md §22) ni permite firmar
la afirmación de un PDF congelado. Estado actual y plan:

- **Hecho**: contenido canónico congelado + hash + vista imprimible determinista (HTML/CSS
  de impresión sin recursos externos ni JavaScript no confiable).
- **Preparado**: `prescription_documents.storage_path`, `mime_type`, `size_bytes` esperan
  el binario; el bucket privado y las URLs firmadas siguen el patrón existente.
- **Pendiente** (fase posterior): generación determinista del PDF en servidor (Edge
  Function, plantilla versionada `template_version`), almacenamiento en bucket privado y
  hash del binario. **No se afirma que el PDF exista hoy.**

`vaccination_documents` sigue exactamente el mismo diseño para comprobantes de vacunación.
