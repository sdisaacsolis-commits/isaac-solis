# Portal público — Reseñas verificadas (Fase 8.1)

Réplica del patrón de opiniones verificadas del marketplace de referencia
(docs/product/doctoralia-audit.md §2.3), con confianza ESTRUCTURAL en lugar de
verificación por teléfono.

## Verificación estructural

Solo se reseña una cita en estado `completed`, y solo el **propietario que asistió** (su
cuenta vinculada del portal). El trigger `enforce_review_refs` exige: cita completada,
coherencia clínica/mascota/propietario/veterinario, y `author_user_id = pet_owners.user_id`.
Índice único por `appointment_id`: **una reseña por cita**. Es el mismo principio que los
folios — no se puede falsear porque depende de un hecho registrado (la cita atendida).

## Entidades

| Tabla                      | Propósito                                                            |
| -------------------------- | -------------------------------------------------------------------- |
| `reviews`                  | Opinión (1–5 + texto), respuesta de la clínica, campos de moderación |
| `review_moderation_events` | Historial append-only (replied/reported/hidden/restored)             |

Estados: `published` (visible) → `hidden` (moderada, contenido conservado) → `published`
(restaurada). El contenido del propietario **jamás se edita ni se borra** por la clínica.

## Flujos y permisos

- **Propietario** (`submit_review`, `update_my_review`): crea su reseña; la edita dentro de
  **30 días** (`PLAZO_EXCEDIDO` después).
- **Clínica** (`reply_to_review`, `report_review`): responde públicamente (una vez) y puede
  **reportar** (deja rastro, NO oculta — evita censurar opiniones honestas).
- **Administración de la organización** (`set_review_visibility`): moderación **elevada** —
  ocultar/restaurar con **motivo obligatorio** y auditoría; único camino para retirar una
  reseña (abuso/difamación).
- **Público** (anon): `get_clinic_reviews` (solo publicadas, **autor enmascarado**
  nombre+inicial) y el promedio de calificación (`clinic_rating`) integrado en
  `search_public_clinics` y `get_public_clinic`. Anon nunca lee la tabla directamente.

## Agregados

`clinic_rating(clinic_id)` = `{average, count}` sobre reseñas publicadas no borradas.
Una reseña oculta o reportada-y-ocultada sale del promedio; reportada-pero-visible sigue
contando (reportar no censura).

## Pruebas

pgTAP suite 14 (31 aserciones; 505 totales): verificación por cita, una por cita,
aislamiento entre organizaciones, respuesta/reporte, moderación elevada con motivo,
contenido conservado al ocultar, enmascarado del autor, historial append-only, anon sin
acceso directo. Zod es-MX (15 unitarias). E2E: reseña de propietario tras cita completada
→ visible en el perfil público → respuesta de la clínica pública.
