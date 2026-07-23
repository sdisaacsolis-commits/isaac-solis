# Auditoría de Doctoralia.com.mx — plano de réplica para Dogtoralia

> Auditoría realizada el 2026-07-21 sobre el sitio público en vivo: portada, resultados
> de búsqueda, directorio especialidad×ciudad, perfil profesional, sección de preguntas
> y respuestas y zona para profesionales. Complementa y detalla
> `doctoralia-parity.md` (plan por fases aprobado en dirección).
>
> **Alcance de "réplica"**: paridad de FUNCIONALIDAD y NAVEGACIÓN con implementación
> 100 % original adaptada al dominio veterinario. No se copia marca, textos, logotipos
> ni diseño visual de Doctoralia (riesgo legal y de confusión); Dogtoralia usa su propio
> tema de marca (`packages/config`), sus textos es-MX y su identidad.

## 1. Mapa del sitio observado

```
/                                  Portada (hero + buscador, directorios, confianza)
/buscar?q=&loc=                    Resultados con filtros y mapa
/{especialidad}/{ciudad}           Directorio SEO programático (p. ej. /pediatra/ciudad-de-mexico)
/{slug-profesional}/{especialidad}/{ciudad}   Perfil público del profesional
/preguntas-respuestas              Q&A público por especialidad
Zona Pro (subdominio)              SaaS para profesionales/clínicas (≈ nuestro /app)
Cuenta de paciente                 Registro/login, citas, notificaciones
```

## 2. Hallazgos por página

### 2.1 Portada

- Hero con buscador de dos campos (qué + dónde) y pestañas Presencial / En línea.
- Contador de confianza ("330 000 profesionales"), 15+ especialidades populares con
  enlaces por ciudad, servicios populares con precios, propuesta de valor en 4 bloques
  (encontrar especialista / cita fácil / recordatorios / sin costo), Q&A recientes,
  opiniones recientes, perfiles nuevos, banners de la zona Pro, footer de dos audiencias
  (pacientes / profesionales) + legal.

### 2.2 Resultados y directorios (búsqueda y especialidad×ciudad)

- Filtros: consulta en línea, fechas disponibles, aseguradora, "más filtros"; mapa
  integrado; paginación numerada profunda (cientos de páginas → SEO programático).
- Tarjeta de resultado: foto, nombre→perfil, especialidades, badges ("Destacado",
  "Pago en línea", "Nuevo perfil"), estrellas + número de opiniones, dirección con mapa,
  múltiples consultorios, precios ("$600", "desde $1,300").
- Orden por relevancia con ponderación declarada (disponibilidad, calificaciones,
  completitud del perfil y plan de suscripción).
- Al pie: búsquedas relacionadas (alcaldías/ciudades cercanas), padecimientos tratados,
  enlaces por aseguradora, breadcrumbs.

### 2.3 Perfil profesional (la página núcleo del marketplace)

- Encabezado: foto, nombre, especialidad, **cédula profesional visible**, estrellas y
  conteo de opiniones verificadas, CTA principal "Agendar cita".
- Secciones/pestañas: Experiencia (formación, padecimientos tratados), Novedades,
  Servicios y precios (20+ servicios con tarifas y nota de variabilidad), Consultorios
  (múltiples sedes + consulta en línea, cada una con teléfono, formas de pago y mapa),
  Aseguradoras (o aviso de solo privados), Opiniones, Dudas solucionadas (Q&A del
  profesional).
- **Widget de reservación**: elegir consultorio → servicio → fecha/hora en calendario;
  **permite reservar sin cuenta previa** (con opción de iniciar sesión).
- **Opiniones con verificación en 3 niveles**: teléfono verificado / cita verificada /
  pago+cita verificados; cada opinión trae autor, fecha, consultorio, servicio y
  respuesta opcional del profesional; resumen de temas frecuentes.
- CTAs secundarios: teléfono por sede, "Enviar mensaje" (con tiempo de respuesta),
  videoconsulta, redes sociales.

### 2.4 Preguntas y respuestas

- Pregunta anónima por formulario (especialidad + correo solo para avisos), moderación
  previa, respuesta típica en ~48 h, varios profesionales pueden responder, aviso legal
  permanente ("contenido informativo, no sustituye un diagnóstico"), estadísticas de
  volumen y enlace a reservar con quien respondió.

### 2.5 Zona Pro (profesionales/clínicas)

- Módulos: agenda 24/7 con recordatorios, perfil optimizado para Google, mensajería,
  consulta en línea, seguridad certificada, IA de notas. Venta por demostración.
- **Equivalencia directa: el panel `/app` de Dogtoralia (Fases 1–7) ya es esto** (agenda
  anti-traslape, expediente, recetas, vacunación, recordatorios por outbox, multiclínica
  con RLS). La IA de notas queda EXCLUIDA por principio de producto (Dogtoralia no
  genera contenido clínico).

## 3. Especificación de la réplica veterinaria (rutas Dogtoralia)

| Doctoralia                    | Dogtoralia (público)                                                     | Notas                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Portada marketplace           | `/` (evoluciona la portada actual)                                       | Hero + buscador (servicio/padecimiento/nombre + ciudad), categorías de `service_category`, ciudades, contadores reales, opiniones recientes, banner "¿Eres veterinario?" → registro del panel          |
| `/buscar?q=&loc=`             | `/buscar?q=&ciudad=`                                                     | Filtros: fechas disponibles (vía `get_available_slots`), categoría de servicio, especie atendida; mapa; paginación                                                                                     |
| `/{especialidad}/{ciudad}`    | `/veterinarios/{ciudad}` y `/servicios/{categoria}/{ciudad}`             | SEO programático generado desde clínicas `is_public`                                                                                                                                                   |
| Perfil profesional            | `/veterinarios/{slug}`                                                   | Foto, **cédula** (`professional_license`), clínicas donde atiende, servicios+precios (centavos→MXN), horarios, opiniones, widget de reservación                                                        |
| Perfil de clínica             | `/clinicas/{slug}`                                                       | Sedes, equipo, servicios, mapa, formas de pago, reservación                                                                                                                                            |
| Widget de reservación         | Selector clínica→servicio→veterinario→hueco real                         | `get_available_slots` + `book_appointment(source='online')` → estado `requested`; **invitado permitido** (nombre+contacto+mascota mínima) con verificación por la clínica, o con cuenta de propietario |
| Cuenta de paciente            | Cuenta de propietario: `/mi/mascotas`, `/mi/citas`, `/mi/historial`      | Solo lectura del historial (consultas finalizadas, cartilla, recetas emitidas) de SUS mascotas verificadas por la clínica                                                                              |
| Opiniones verificadas         | Reseñas ligadas a cita `completed` del propietario que asistió           | Niveles de verificación estructurales (cita verificada / cita+pago futuro); respuesta de la clínica; sin edición tras publicar; moderación por reporte                                                 |
| Q&A "Pregunta al Experto"     | Q&A veterinario (fase C, opcional)                                       | Anónimo + moderación + aviso "no sustituye consulta veterinaria"; responden solo veterinarios verificados con cédula                                                                                   |
| Recordatorios SMS             | Correo (outbox actual); WhatsApp Cloud API post-MVP confirmado           | SMS no previsto                                                                                                                                                                                        |
| Perfiles "Destacado" / planes | Fase C (modelo comercial con `plans`/`subscriptions` de ROADMAP Fase 11) | El orden público inicial es neutral: disponibilidad + completitud, sin pago por ranking                                                                                                                |
| Aseguradoras                  | No aplica en veterinaria (v1)                                            | Se omite; el filtro equivalente útil es especie/servicio                                                                                                                                               |

## 4. Decisiones de réplica (adaptación honesta al dominio)

1. **Reserva sin cuenta**: se replica (baja fricción, igual que Doctoralia); la cita
   entra como `requested` y la clínica confirma — el modelo de estados de la Fase 5 ya
   lo contempla. Anti-abuso: rate-limit + verificación de contacto por el outbox.
2. **Cédula visible** en perfiles públicos de veterinarios (paridad de confianza).
3. **Opiniones**: solo post-asistencia real (estructural, vía cita `completed` del
   propietario) — más estricto que el nivel básico "teléfono verificado" de Doctoralia.
4. **Sin IA clínica ni "notas automáticas"**: principio innegociable de Dogtoralia.
5. **Privacidad**: el portal público jamás expone datos clínicos ni de otras clínicas;
   perfiles solo de clínicas `is_public` con `accepts_online_booking` para reservar.
6. **Marca propia**: paridad de patrones de navegación y funcionalidad; cero copia de
   textos, estilos o activos de Doctoralia.

## 5. Orden de construcción

El plan por fases (A: portal público + reservación + cuenta de propietario; B: reseñas;
C: Q&A/telemedicina/planes) vive en `doctoralia-parity.md` §3 y en el ROADMAP como
[Propuesta] Fase 8. Esta auditoría es su especificación de referencia.
