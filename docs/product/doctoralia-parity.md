# [Propuesta] Paridad funcional con Doctoralia.com.mx — portal público veterinario

> Estado: **propuesta aprobada en dirección por el propietario del producto** (2026-07-21,
> "quiero que tenga la misma funcionalidad y navegación"); pendiente de ejecutarse por
> fases con los mismos criterios de calidad del resto del proyecto (CLAUDE.md §23).

## 1. Análisis de Doctoralia México (health-tech humano, referencia de producto)

Análisis realizado sobre `https://www.doctoralia.com.mx` (portada y resultados de
búsqueda; el patrón de perfiles se deriva de su navegación).

### 1.1 Navegación pública

| Elemento                     | Doctoralia                                                                                                                            | Equivalente Dogtoralia (veterinario)                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Hero con buscador            | "especialidad, enfermedad o nombre" + ciudad + pestañas Presencial/En línea                                                           | "servicio, padecimiento o veterinario" + ciudad (En línea: fase posterior)                                        |
| Directorio de especialidades | 15+ especialidades con páginas por ciudad (`/pediatra/ciudad-de-mexico`)                                                              | Servicios/categorías veterinarias por ciudad (`/veterinarios/cdmx`, `/servicios/vacunacion/guadalajara`)          |
| Directorio de servicios      | Electrocardiograma, vasectomía… con precios                                                                                           | Catálogo `clinic_services` público (consulta, vacunación, estética, urgencias)                                    |
| Resultados de búsqueda       | Filtros (modalidad, fechas disponibles, seguro), tarjeta con foto, reseñas, dirección/mapa, precios, calendario integrado, paginación | Tarjeta de veterinario/clínica con foto, reseñas, dirección, precios y **huecos reales de `get_available_slots`** |
| Perfil público               | Foto, especialidades, consultorios, servicios+precios, reseñas, Q&A, calendario de reservación                                        | `/veterinarios/[slug]` y `/clinicas/[slug]` (ya previstos como confirmados en ROADMAP post-MVP #2)                |
| Cuenta de paciente           | Crear cuenta, iniciar sesión, citas, recordatorios SMS                                                                                | Cuenta de **propietario** (los cimientos existen: `pet_owners.user_id`, `can_access_portal`)                      |
| Pregunta al Experto          | Q&A público moderado por especialistas                                                                                                | Q&A veterinario (opcional, fase tardía)                                                                           |
| Zona para profesionales      | Doctoralia Pro (SaaS de agenda/perfil/reseñas)                                                                                        | **Ya existe: es el panel `/app` construido en Fases 1–7**                                                         |
| Confianza                    | "330 000 profesionales", reseñas verificadas, premios                                                                                 | Contadores reales, reseñas verificadas post-cita                                                                  |

### 1.2 Funcionalidad clave observada

1. **Búsqueda** por especialidad/nombre + ubicación, con filtros de modalidad, fechas
   disponibles y seguro; orden por relevancia con perfiles destacados.
2. **Reservación en línea** sin costo: calendario con horarios reales en la tarjeta de
   resultados y en el perfil; confirmación instantánea y recordatorios.
3. **Reseñas 5 estrellas** verificadas (solo pacientes que asistieron), visibles en
   tarjetas, perfiles y portada.
4. **Q&A público** ("Pregunta al Experto") con respuestas de profesionales verificados.
5. **Páginas SEO programáticas**: especialidad×ciudad y servicio×ciudad.
6. **Dos audiencias separadas**: sitio público para pacientes + SaaS para profesionales.

## 2. Qué existe ya en Dogtoralia (no se rehace nada)

- Panel profesional completo (Fases 1–7) = la "zona Pro" de Doctoralia.
- Agenda con disponibilidad real (`get_available_slots`), anti-traslape estructural,
  estados con `requested` (pensado para solicitudes públicas) y fuente de cita
  (`appointment_source`), colchones y excepciones.
- `clinics.is_public`, `clinics.accepts_online_booking` y slugs globales — previstos
  desde la Fase 2 para el portal público.
- `pet_owners.user_id` (enlace a cuenta con verificación explícita) y
  `can_access_portal` — previstos desde la Fase 4.
- Outbox de notificaciones (confirmaciones/recordatorios) reutilizable para el flujo
  público (correo hoy; WhatsApp confirmado como proveedor posterior).

## 3. Brecha y plan por fases [Propuesta]

### Fase A — Portal público y reservación en línea (paridad núcleo)

1. **Perfiles públicos**: `/clinicas/[slug]` y `/veterinarios/[slug]` (SSR + SEO,
   solo clínicas `is_public`); foto, servicios con precios, horarios, dirección/mapa,
   veterinarios de la clínica con cédula.
2. **Búsqueda pública**: `/buscar?q=&ciudad=` sobre clínicas/veterinarios/servicios
   públicos; directorios programáticos `/veterinarios/[ciudad]` y
   `/servicios/[categoria]/[ciudad]`.
3. **Cuenta de propietario** (`role` portal): registro/login reutilizando Supabase Auth;
   vinculación propietario↔cuenta SIEMPRE por verificación explícita de la clínica
   (regla de Fase 4); "Mis mascotas", "Mis citas", historial visible (consultas
   finalizadas, cartilla, recetas emitidas de sus mascotas — RLS nueva de solo lectura).
4. **Reservación pública**: selector de huecos reales (`get_available_slots`) →
   `book_appointment` con `source='online'` y estado `requested`/`pending_confirmation`;
   la clínica confirma desde el panel (flujo ya existente); confirmación y recordatorios
   por el outbox.
5. Navegación pública: header (buscador, Crear cuenta, Iniciar sesión, "¿Eres
   veterinario?") + footer (pacientes/profesionales/legal), portada con hero, categorías
   populares, ciudades y contadores reales.

### Fase B — Confianza (reseñas)

6. **Reseñas verificadas**: tabla `reviews` ligada a cita `completed` (solo el
   propietario que asistió), calificación 1–5 + texto, moderación por la clínica
   (responder/reportar, nunca editar), agregados en perfiles y resultados. RLS + pgTAP.

### Fase C — Complementos (opcionales, decisión de producto)

7. Q&A público veterinario; consulta en línea (telemedicina — hoy fuera de alcance);
   destacados/planes (modelo comercial); apps móviles (ROADMAP Fase 8 actual).

### Encaje con el ROADMAP

La Fase A absorbe y adelanta el post-MVP #2 (perfiles públicos confirmados) y parte de la
Fase 8 (portal del propietario, versión web antes que Flutter). Recomendación: ejecutar
Fase A como **nueva Fase 8 del ROADMAP**, B como Fase 8.1, y reevaluar C después.

## 4. Restricciones que se mantienen (innegociables)

- Aislamiento multiclínica y RLS forzado también en todo lo público (lo público expone
  SOLO lo marcado `is_public`; jamás datos clínicos).
- El expediente del propietario es **solo lectura** y solo de SUS mascotas verificadas.
- Sin recomendaciones clínicas automáticas tampoco en el portal.
- Reseñas solo post-asistencia real (anti-fraude estructural, como los folios).
- Textos es-MX vía i18n; accesibilidad; pruebas pgTAP/E2E y CI como en toda fase.
