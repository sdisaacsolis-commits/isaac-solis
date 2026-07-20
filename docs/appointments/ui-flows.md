# Agenda — Flujos de UI

## Rutas

| Ruta                                               | Contenido                                                                                                                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/app/agenda`                                      | Vistas **Día** (default), **Semana** y **Lista** (tabla accesible); navegación anterior/hoy/siguiente; filtros por veterinario y estado.                                                                            |
| `/app/agenda/nueva`                                | Reserva en dos pasos server-rendered: (1) paciente + servicio + veterinario + fecha → (2) slots disponibles (radio) + motivo/notas/urgencia.                                                                        |
| `/app/agenda/[id]`                                 | Detalle: folio, estado, paciente/propietario (enlaces), servicios con snapshot y total, acciones de transición (solo las válidas), reagendar, cancelar con motivo, historial de estados y estado de notificaciones. |
| `/app/configuracion/servicios` (+ `nuevo`, `[id]`) | Catálogo: alta por RPC, edición directa (RLS admin), asignación de veterinarios por checkbox, activar/desactivar.                                                                                                   |
| `/app/configuracion/horarios`                      | Por profesional: ventanas semanales (formulario dinámico → RPC de reemplazo) y excepciones (alta/baja).                                                                                                             |

## Principios

- **Server Components para lectura, Server Actions delgadas para escritura**
  (validación Zod → conversión de zona → RPC → mapeo de errores es-MX).
- La UI muestra solo transiciones válidas (`APPOINTMENT_TRANSITIONS`), pero la
  autorización real está en la base: un botón forzado recibe
  `TRANSICION_INVALIDA`/`PERMISO_DENEGADO` traducidos a mensajes claros.
- El flujo de reserva navega por `searchParams` (GET) hasta elegir slot:
  accesible, sin estado de cliente frágil, y el POST final es la única acción.
- Vista Lista = tabla semántica con encabezados (lectores de pantalla);
  fechas/importes formateados con `Intl` es-MX en la zona de la clínica.
- El dashboard (`/app/inicio`) muestra conteos reales: citas hoy, próximas
  7 días, completadas y canceladas del mes (sin porcentajes inventados).
