# Agenda — Walk-ins y urgencias

## Walk-in (llega sin cita)

- `book_appointment(..., p_source => 'walk_in')`.
- Nace en **`checked_in`** con `checked_in_at = now()` (ya está en recepción).
- **No exige** ventana de horario del profesional (la persona ya está ahí),
  pero **sí respeta el anti-traslape**: si el veterinario está ocupado, la
  reserva falla y hay que elegir otro profesional u horario.
- Requiere paciente registrado (walk-in con mascota nueva: primero el alta
  rápida de propietario/mascota de la Fase 4, luego la cita).
- En la UI queda etiquetado "Sin cita previa" (badge) vía `source`.

## Urgencia (emergency override)

- `p_emergency => true` **exige** `p_emergency_reason` (`MOTIVO_REQUERIDO`).
- Permite agendar **fuera del horario** del profesional y sobre excepciones
  bloqueantes (el veterinario de guardia atiende aunque "no atienda").
- **No** permite traslaparse con otra cita ocupada: el `EXCLUDE` es absoluto.
  Debilitarlo crearía dobles reservas reales; si el profesional está ocupado,
  la urgencia se asigna a otro miembro o se reagenda lo existente.
- Queda visible (badge "Urgencia"), con motivo en la cita y rastro completo en
  `audit_log` (insert con `emergency = true` + actor).
- Reagendar una cita de urgencia tampoco exige ventana de horario.
