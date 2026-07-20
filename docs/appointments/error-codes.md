# Agenda — Códigos de error de dominio

Las RPCs fallan con `PREFIJO_ESTABLE: descripción` y un `errcode` PostgreSQL
coherente; las Server Actions los traducen a mensajes es-MX
(`mapearErrorAgenda`). Nunca se muestran detalles internos al usuario.

| Código                                              | errcode     | Significado                                      | Mensaje UI                                     |
| --------------------------------------------------- | ----------- | ------------------------------------------------ | ---------------------------------------------- |
| `PERMISO_DENEGADO`                                  | 42501       | El rol no puede realizar la operación            | "Tu rol no puede realizar esta operación."     |
| `HORARIO_OCUPADO`                                   | 23P01       | EXCLUDE anti-traslape (reserva o reagendado)     | "Ese horario ya está ocupado…"                 |
| `FUERA_DE_HORARIO`                                  | 23514       | Slot fuera de las ventanas del profesional       | "El profesional no atiende en ese horario."    |
| `NO_DISPONIBLE`                                     | 23514       | Excepción bloqueante en el rango                 | "Hay una excepción de agenda…"                 |
| `TRANSICION_INVALIDA`                               | 23514       | Máquina de estados                               | "Ese cambio de estado no está permitido…"      |
| `ESTADO_INVALIDO`                                   | 23514       | Reagendar una cita ya iniciada/terminal          | "La cita ya no puede reagendarse…"             |
| `MOTIVO_REQUERIDO`                                  | 22023       | Cancelación o urgencia sin motivo                | "Escribe el motivo para continuar."            |
| `FECHA_PASADA`                                      | 22023       | Reserva/reagendado hacia el pasado               | "No puedes agendar en el pasado."              |
| `MASCOTA_SIN_RELACION`                              | 23514       | Paciente sin relación activa con la clínica      | "La mascota no está registrada…"               |
| `PROPIETARIO_SIN_RELACION`                          | 23514       | Propietario sin relación con la mascota          | genérico                                       |
| `SERVICIO_INVALIDO` / `SERVICIOS_*`                 | P0002/22023 | Servicio inexistente/inactivo o lista inválida   | "Algún servicio elegido no está disponible…"   |
| `SERVICIO_DUPLICADO`                                | 23505       | Nombre repetido en catálogo activo               | "Ya existe un servicio activo con ese nombre." |
| `HORARIO_TRASLAPADO`                                | 23P01       | Ventanas semanales cruzadas                      | "Dos ventanas del mismo día se cruzan…"        |
| `HORARIO_INVALIDO`                                  | 22023       | JSON de ventanas malformado                      | genérico                                       |
| `RANGO_EXCESIVO`                                    | 22023       | Disponibilidad > 31 días                         | (la UI consulta 1 día)                         |
| `MIEMBRO_NO_VETERINARIO`                            | 23514       | Asignación/horario/cita a quien no es vet activo | genérico                                       |
| `CLINICA_FUERA_DE_ORGANIZACION`                     | 23514       | Integridad tenant                                | genérico                                       |
| `CITA_NO_ENCONTRADA` / `NOTIFICACION_NO_ENCONTRADA` | P0002       | Id inexistente (o invisible por RLS)             | genérico                                       |
| `LIMITE_INVALIDO`                                   | 22023       | claim del outbox fuera de 1–50                   | interno                                        |
