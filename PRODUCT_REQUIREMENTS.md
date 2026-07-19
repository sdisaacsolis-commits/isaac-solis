# Dogtoralia — Requerimientos de Producto (PRD)

> Versión 0.1 — Etapa de arquitectura. Este documento define el alcance del MVP.
> Todo lo marcado como **[Propuesta]** NO forma parte del alcance comprometido y requiere aprobación.

## 1. Visión

Dogtoralia es una plataforma SaaS mexicana para la gestión de clínicas veterinarias y la relación
entre clínicas, médicos veterinarios y propietarios de mascotas. Se inspira en plataformas de
reservación médica como Doctoralia, pero especializada exclusivamente en servicios veterinarios.

- **Mercado inicial**: México.
- **Idioma inicial**: español de México (`es-MX`).
- **Moneda**: peso mexicano (MXN).
- **Zona horaria principal**: `America/Mexico_City` (almacenamiento interno siempre en UTC).
- **Tono de marca**: moderno, confiable, profesional, amigable y enfocado en el bienestar animal.

## 2. Usuarios y roles

| Rol | Ámbito | Descripción |
|---|---|---|
| Superadministrador | Global (plataforma) | Personal de Dogtoralia. Administra clínicas, planes y soporte. No accede a expedientes clínicos salvo procesos de soporte auditados. |
| Administrador de clínica | Una clínica | Configura la clínica, gestiona personal, servicios, horarios y ve reportes. |
| Médico veterinario | Una clínica (puede pertenecer a varias) | Atiende citas, crea y consulta expedientes, registra vacunas/tratamientos, emite recetas. |
| Recepcionista | Una clínica | Gestiona agenda: crea, confirma, cancela y reprograma citas. Registra propietarios y mascotas. No accede al detalle médico del expediente. |
| Propietario de mascota | Global (sus mascotas) | Registra sus mascotas, agenda citas, recibe recordatorios y consulta el historial de sus mascotas. |

Reglas transversales:

- Los roles de clínica (administrador, veterinario, recepcionista) se asignan **por clínica**:
  una misma persona puede tener roles distintos en clínicas distintas.
- **Una clínica jamás puede consultar información de otra clínica.** Este aislamiento se aplica a
  nivel de base de datos (Row Level Security), no solo en la aplicación.
- El propietario solo ve información de **sus** mascotas.

## 3. Alcance funcional del MVP

### 3.1 Gestión de clínicas
- Alta de clínica (nombre, RFC opcional, dirección, teléfono, correo, logotipo).
- El superadministrador aprueba/activa clínicas nuevas.
- Configuración de horarios de operación y servicios ofrecidos con precio en MXN.

### 3.2 Gestión de personal
- Alta de veterinarios (nombre, cédula profesional, especialidad, biografía, fotografía).
- Alta de recepcionistas.
- Invitación por correo electrónico; el invitado crea su cuenta y queda vinculado a la clínica.

### 3.3 Propietarios y mascotas
- Registro de propietario (autoservicio desde la app móvil o creado por recepción).
- Perfil de mascota: nombre, especie, raza, sexo, fecha de nacimiento (o edad estimada),
  peso, color, señas particulares, fotografía, número de microchip (opcional).
- Una mascota pertenece a un propietario; puede ser atendida en varias clínicas.

### 3.4 Agenda de citas
- Disponibilidad por veterinario (días y bloques de horario).
- Creación de cita: mascota + veterinario + servicio + fecha/hora.
- Estados de la cita: `solicitada → confirmada → en_curso → completada`,
  con salidas a `cancelada` y `no_asistio`, y reprogramación con rastro del historial.
- La recepción y el propietario pueden solicitar citas; la clínica confirma.
- Prevención de traslapes de horario por veterinario.

### 3.5 Expediente clínico veterinario
- Un expediente por mascota **por clínica** (el historial médico es propiedad de la relación
  clínica–mascota; el propietario ve un consolidado de sus mascotas).
- Notas de consulta: motivo, anamnesis, exploración física (peso, temperatura, FC, FR),
  diagnósticos, tratamientos, indicaciones.
- Registro de vacunas (biológico, lote, fecha de aplicación, fecha de próxima aplicación).
- Registro de desparasitaciones (producto, dosis, fecha, próxima aplicación).
- Archivos adjuntos (estudios, radiografías) en almacenamiento privado.
- Los registros clínicos **no se eliminan**: se corrigen mediante adendas con trazabilidad.

### 3.6 Recetas veterinarias
- Emisión de receta ligada a una consulta: medicamentos, dosis, vía, frecuencia, duración,
  indicaciones. Datos del emisor (nombre y cédula profesional) y de la clínica.
- Generación de PDF descargable/imprimible.

### 3.7 Recordatorios y notificaciones
- Recordatorio de próxima cita (push + correo) 24 h antes. **[Configurable por clínica: Propuesta]**
- Recordatorio de vacunas y desparasitaciones próximas a vencer.
- Notificación al propietario cuando su cita es confirmada, cancelada o reprogramada.

### 3.8 Panel administrativo por clínica
- Resumen del día: citas, confirmaciones pendientes.
- Gestión de personal, servicios y horarios.
- Métricas básicas: citas por periodo, tasa de cancelación/inasistencia.

### 3.9 Preparación para suscripciones (sin cobro en MVP)
- Modelo de datos de planes y suscripciones desde el inicio.
- Toda clínica del MVP opera en un plan "beta/gratuito".
- La integración de cobro con Stripe se activa en una fase posterior.

## 4. Fuera de alcance del MVP

- Cobro real de suscripciones y facturación (CFDI).
- Marketplace público de búsqueda de clínicas (perfil público tipo directorio). **[Propuesta fase 2]**
- App móvil para veterinarios (fase posterior; el panel web será responsivo).
- Telemedicina, inventario de farmacia, punto de venta, hospitalización.
- Recordatorios por WhatsApp Business API. **[Propuesta — canal dominante en México, alta prioridad post-MVP]**
- Multi-idioma (la arquitectura de i18n queda preparada, pero solo se entrega `es-MX`).

## 5. Requerimientos no funcionales

| Área | Requerimiento |
|---|---|
| Seguridad | Aislamiento multi-clínica por RLS; permisos por rol; sin secretos en el código; variables de entorno. |
| Privacidad | Datos personales y clínicos tratados conforme a la LFPDPPP; aviso de privacidad; derechos ARCO considerados en el diseño (exportación/eliminación de cuenta). |
| Trazabilidad | Bitácora de auditoría (`audit_log`) para operaciones sensibles: expedientes, recetas, cambios de rol, cancelaciones. |
| Calidad | TypeScript estricto, validación de datos en frontera (Zod), manejo de errores consistente, pruebas automatizadas desde la primera fase. |
| Disponibilidad | Objetivo MVP: mejor esfuerzo sobre infraestructura gestionada (Vercel + Supabase). |
| Accesibilidad | Componentes accesibles (WCAG AA como meta), navegación por teclado en el panel web. |
| Localización | Fechas, horas y moneda en formato mexicano; almacenamiento en UTC. |

## 6. Riesgos identificados

### Riesgos técnicos
1. **Fuga de datos entre clínicas** — el riesgo más grave. Mitigación: RLS obligatorio en toda
   tabla con `clinic_id`, pruebas automatizadas específicas de aislamiento, revisión de cada política.
2. **Errores de zona horaria en la agenda** — citas mostradas u ordenadas en hora incorrecta.
   Mitigación: `timestamptz` siempre, conversión a `America/Mexico_City` solo en presentación.
3. **Traslapes y condiciones de carrera en la agenda** — dos citas simultáneas para el mismo
   veterinario. Mitigación: restricción de exclusión (`EXCLUDE USING gist`) en PostgreSQL.
4. **Dependencia de Supabase (vendor lock-in)** — mitigación: es PostgreSQL estándar; migraciones
   SQL versionadas en el repo permiten migrar a Postgres autogestionado si fuera necesario.
5. **Entrega de notificaciones** — FCM/correo pueden fallar silenciosamente. Mitigación: tabla de
   notificaciones con estado y reintentos, no "disparar y olvidar".

### Riesgos de producto
1. **Adopción por clínicas** — las clínicas pequeñas usan papel o Excel; la curva de adopción debe
   ser mínima (alta de clínica en minutos, captura rápida en recepción).
2. **Doble mercado (clínica y propietario)** — el valor para el propietario depende de que su
   clínica use la plataforma. El MVP prioriza el flujo de la clínica; la app del propietario
   consume valor generado por la clínica.
3. **Requisitos regulatorios de recetas veterinarias** — las recetas de medicamentos controlados
   tienen requisitos especiales (SADER/SENASICA). El MVP emite recetas simples y **excluye
   medicamentos controlados**; se documenta como restricción visible.
4. **Canal de recordatorios** — correo tiene baja apertura en este mercado; sin WhatsApp el valor
   percibido de los recordatorios baja. Se prioriza push (app) + correo y se planea WhatsApp.

## 7. Métricas de éxito del MVP

- Clínicas activas con al menos 10 citas/semana gestionadas en la plataforma.
- ≥ 60 % de citas confirmadas mediante la plataforma (no por teléfono).
- ≥ 30 % de propietarios con la app instalada por clínica activa.
- Cero incidentes de acceso a datos entre clínicas.
