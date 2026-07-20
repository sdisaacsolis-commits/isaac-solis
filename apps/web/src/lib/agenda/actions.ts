"use server";

import {
  bookAppointmentSchema,
  cancelAppointmentSchema,
  configureScheduleSchema,
  createServiceSchema,
  rescheduleAppointmentSchema,
  scheduleExceptionSchema,
  transitionAppointmentSchema,
  updateServiceSchema,
} from "@dogtoralia/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import { localAUtc } from "./dates";
import { procesarNotificacionesDeClinica } from "./notificaciones";

/**
 * Server Actions de agenda: DELGADAS a propósito. Validan con Zod, convierten
 * horas locales de la clínica a UTC y delegan TODA la lógica de dominio a las
 * RPCs (permisos, máquina de estados, anti-traslape, folios, outbox).
 */

function sinSupabase(): FormState {
  return { ok: false, message: mensajes.comun.supabaseNoConfigurado };
}

function texto(formData: FormData, campo: string): string | undefined {
  const v = formData.get(campo);
  if (typeof v !== "string") return undefined;
  const limpio = v.trim();
  return limpio === "" ? undefined : limpio;
}

/** Traduce los códigos estables de las RPCs a mensajes es-MX del diccionario. */
function mapearErrorAgenda(mensaje: string): string {
  const e = mensajes.agenda.errores;
  if (mensaje.includes("HORARIO_OCUPADO")) return e.horarioOcupado;
  if (mensaje.includes("FUERA_DE_HORARIO")) return e.fueraDeHorario;
  if (mensaje.includes("NO_DISPONIBLE")) return e.noDisponible;
  if (mensaje.includes("TRANSICION_INVALIDA")) return e.transicionInvalida;
  if (mensaje.includes("ESTADO_INVALIDO")) return e.estadoInvalido;
  if (mensaje.includes("MOTIVO_REQUERIDO")) return e.motivoRequerido;
  if (mensaje.includes("FECHA_PASADA")) return e.fechaPasada;
  if (mensaje.includes("PERMISO_DENEGADO")) return e.sinPermiso;
  if (mensaje.includes("MASCOTA_SIN_RELACION")) return e.mascotaSinRelacion;
  if (mensaje.includes("SERVICIO_INVALIDO") || mensaje.includes("SERVICIOS_"))
    return e.servicioInvalido;
  if (mensaje.includes("HORARIO_TRASLAPADO")) return mensajes.horarios.traslape;
  if (mensaje.includes("SERVICIO_DUPLICADO")) return mensajes.servicios.duplicado;
  return mensajes.comun.errorInesperado;
}

async function zonaDeClinica(clinicId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clinics")
    .select("timezone")
    .eq("id", clinicId)
    .maybeSingle();
  return data?.timezone ?? "America/Mexico_City";
}

// ---------------------------------------------------------------------------
// Catálogo de servicios
// ---------------------------------------------------------------------------
export async function crearServicio(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = createServiceSchema.safeParse({
    clinicId: formData.get("clinicId"),
    name: texto(formData, "name"),
    category: texto(formData, "category"),
    description: texto(formData, "description"),
    durationMinutes: texto(formData, "durationMinutes"),
    bufferBeforeMinutes: texto(formData, "bufferBeforeMinutes") ?? 0,
    bufferAfterMinutes: texto(formData, "bufferAfterMinutes") ?? 0,
    priceCents: texto(formData, "price") ?? 0,
    requiresVeterinarian: formData.get("requiresVeterinarian") === "on",
    veterinarianMemberIds: formData.getAll("veterinarianMemberIds").map(String).filter(Boolean),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_clinic_service", {
    p_clinic_id: parsed.data.clinicId,
    p_name: parsed.data.name,
    p_category: parsed.data.category,
    p_duration_minutes: parsed.data.durationMinutes,
    p_price_cents: parsed.data.priceCents,
    p_description: parsed.data.description,
    p_buffer_before_minutes: parsed.data.bufferBeforeMinutes,
    p_buffer_after_minutes: parsed.data.bufferAfterMinutes,
    p_requires_veterinarian: parsed.data.requiresVeterinarian,
    p_veterinarian_member_ids: parsed.data.veterinarianMemberIds ?? undefined,
  });
  if (error) return { ok: false, message: mapearErrorAgenda(error.message) };

  revalidatePath("/app/configuracion/servicios");
  redirect("/app/configuracion/servicios");
}

export async function actualizarServicio(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const serviceId = z.string().uuid().safeParse(formData.get("serviceId"));
  if (!serviceId.success) return { ok: false, message: mensajes.comun.errorInesperado };

  const parsed = updateServiceSchema.safeParse({
    name: texto(formData, "name"),
    category: texto(formData, "category"),
    description: texto(formData, "description"),
    durationMinutes: texto(formData, "durationMinutes"),
    bufferBeforeMinutes: texto(formData, "bufferBeforeMinutes") ?? 0,
    bufferAfterMinutes: texto(formData, "bufferAfterMinutes") ?? 0,
    priceCents: texto(formData, "price") ?? 0,
    requiresVeterinarian: formData.get("requiresVeterinarian") === "on",
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_services")
    .update({
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description ?? null,
      duration_minutes: parsed.data.durationMinutes,
      buffer_before_minutes: parsed.data.bufferBeforeMinutes,
      buffer_after_minutes: parsed.data.bufferAfterMinutes,
      price_cents: parsed.data.priceCents,
      requires_veterinarian: parsed.data.requiresVeterinarian,
      active: parsed.data.active,
    })
    .eq("id", serviceId.data)
    .select("id, clinic_id");
  if (error || !data || data.length === 0) {
    return {
      ok: false,
      message: error ? mapearErrorAgenda(error.message) : mensajes.agenda.errores.sinPermiso,
    };
  }

  // Asignación de veterinarios: reemplazo declarativo (insert/delete directos
  // con RLS de administración).
  const deseados = new Set(formData.getAll("veterinarianMemberIds").map(String).filter(Boolean));
  const { data: actuales } = await supabase
    .from("clinic_service_veterinarians")
    .select("id, clinic_member_id")
    .eq("clinic_service_id", serviceId.data);
  const aBorrar = (actuales ?? []).filter((v) => !deseados.has(v.clinic_member_id));
  const existentes = new Set((actuales ?? []).map((v) => v.clinic_member_id));
  const aCrear = [...deseados].filter((id) => !existentes.has(id));
  if (aBorrar.length > 0) {
    await supabase
      .from("clinic_service_veterinarians")
      .delete()
      .in(
        "id",
        aBorrar.map((v) => v.id),
      );
  }
  if (aCrear.length > 0) {
    const { error: errorAsignar } = await supabase.from("clinic_service_veterinarians").insert(
      aCrear.map((clinicMemberId) => ({
        clinic_service_id: serviceId.data,
        clinic_member_id: clinicMemberId,
      })),
    );
    if (errorAsignar) return { ok: false, message: mapearErrorAgenda(errorAsignar.message) };
  }

  revalidatePath("/app/configuracion/servicios");
  return { ok: true, message: mensajes.servicios.actualizado };
}

// ---------------------------------------------------------------------------
// Horarios y excepciones
// ---------------------------------------------------------------------------
export async function configurarHorario(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const weekdays = formData.getAll("weekday").map(String);
  const inicios = formData.getAll("startTime").map(String);
  const fines = formData.getAll("endTime").map(String);
  const slots = weekdays
    .map((weekday, i) => ({ weekday, startTime: inicios[i], endTime: fines[i] }))
    .filter((s) => s.weekday && s.startTime && s.endTime);

  const parsed = configureScheduleSchema.safeParse({
    clinicId: formData.get("clinicId"),
    clinicMemberId: formData.get("clinicMemberId"),
    slots,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: mensajes.horarios.traslape,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("configure_veterinarian_schedule", {
    p_clinic_id: parsed.data.clinicId,
    p_clinic_member_id: parsed.data.clinicMemberId,
    p_slots: parsed.data.slots.map((s) => ({
      weekday: s.weekday,
      start_time: s.startTime,
      end_time: s.endTime,
    })),
  });
  if (error) return { ok: false, message: mapearErrorAgenda(error.message) };

  revalidatePath("/app/configuracion/horarios");
  return { ok: true, message: mensajes.horarios.horarioGuardado };
}

export async function crearExcepcion(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = scheduleExceptionSchema.safeParse({
    clinicId: formData.get("clinicId"),
    clinicMemberId: texto(formData, "clinicMemberId"),
    type: texto(formData, "type"),
    startsAt: texto(formData, "startsAt"),
    endsAt: texto(formData, "endsAt"),
    reason: texto(formData, "reason"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const tz = await zonaDeClinica(parsed.data.clinicId);
  const supabase = await createClient();
  const { data: clinica } = await supabase
    .from("clinics")
    .select("organization_id")
    .eq("id", parsed.data.clinicId)
    .maybeSingle();
  if (!clinica) return { ok: false, message: mensajes.comun.errorInesperado };

  const { error } = await supabase.from("schedule_exceptions").insert({
    organization_id: clinica.organization_id,
    clinic_id: parsed.data.clinicId,
    clinic_member_id: parsed.data.clinicMemberId ?? null,
    type: parsed.data.type,
    starts_at: localAUtc(parsed.data.startsAt, tz).toISOString(),
    ends_at: localAUtc(parsed.data.endsAt, tz).toISOString(),
    reason: parsed.data.reason ?? null,
  });
  if (error) {
    return {
      ok: false,
      message:
        error.code === "42501"
          ? mensajes.agenda.errores.sinPermiso
          : mensajes.comun.errorInesperado,
    };
  }

  revalidatePath("/app/configuracion/horarios");
  return { ok: true, message: mensajes.horarios.excepcionCreada };
}

export async function eliminarExcepcion(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const id = z.string().uuid().safeParse(formData.get("exceptionId"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("schedule_exceptions").delete().eq("id", id.data);
  revalidatePath("/app/configuracion/horarios");
}

// ---------------------------------------------------------------------------
// Citas
// ---------------------------------------------------------------------------
export async function agendarCita(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = bookAppointmentSchema.safeParse({
    clinicId: formData.get("clinicId"),
    petId: texto(formData, "petId"),
    ownerId: texto(formData, "ownerId"),
    veterinarianMemberId: texto(formData, "veterinarianMemberId"),
    serviceIds: formData.getAll("serviceIds").map(String).filter(Boolean),
    start: texto(formData, "start"),
    source: texto(formData, "source") ?? "staff",
    reason: texto(formData, "reason"),
    emergency: formData.get("emergency") === "on",
    emergencyReason: texto(formData, "emergencyReason"),
    notes: texto(formData, "notes"),
  });
  if (!parsed.success) {
    const errores = parsed.error.flatten();
    return {
      ok: false,
      message: errores.fieldErrors.start ? mensajes.agenda.nueva.seleccionaHorario : undefined,
      fieldErrors: errores.fieldErrors,
    };
  }

  const tz = await zonaDeClinica(parsed.data.clinicId);
  const supabase = await createClient();
  const { data: citaId, error } = await supabase.rpc("book_appointment", {
    p_clinic_id: parsed.data.clinicId,
    p_pet_id: parsed.data.petId,
    p_owner_id: parsed.data.ownerId,
    p_veterinarian_clinic_member_id: parsed.data.veterinarianMemberId,
    p_service_ids: parsed.data.serviceIds,
    p_start: localAUtc(parsed.data.start, tz).toISOString(),
    p_source: parsed.data.source,
    p_reason: parsed.data.reason,
    p_emergency: parsed.data.emergency,
    p_emergency_reason: parsed.data.emergencyReason,
    p_notes: parsed.data.notes,
  });
  if (error || !citaId) {
    return {
      ok: false,
      message: error ? mapearErrorAgenda(error.message) : mensajes.comun.errorInesperado,
    };
  }

  await procesarNotificacionesDeClinica(parsed.data.clinicId);
  revalidatePath("/app/agenda");
  redirect(`/app/agenda/${citaId}`);
}

export async function transicionarCita(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = transitionAppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    newStatus: texto(formData, "newStatus"),
    reason: texto(formData, "reason"),
  });
  if (!parsed.success) return { ok: false, message: mensajes.comun.errorInesperado };

  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_appointment_status", {
    p_appointment_id: parsed.data.appointmentId,
    p_new_status: parsed.data.newStatus,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, message: mapearErrorAgenda(error.message) };

  const { data: cita } = await supabase
    .from("appointments")
    .select("clinic_id")
    .eq("id", parsed.data.appointmentId)
    .maybeSingle();
  if (cita) await procesarNotificacionesDeClinica(cita.clinic_id);

  revalidatePath(`/app/agenda/${parsed.data.appointmentId}`);
  revalidatePath("/app/agenda");
  return { ok: true, message: mensajes.agenda.detalle.estadoActualizado };
}

export async function cancelarCita(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = cancelAppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    reason: texto(formData, "reason"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_appointment", {
    p_appointment_id: parsed.data.appointmentId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, message: mapearErrorAgenda(error.message) };

  const { data: cita } = await supabase
    .from("appointments")
    .select("clinic_id")
    .eq("id", parsed.data.appointmentId)
    .maybeSingle();
  if (cita) await procesarNotificacionesDeClinica(cita.clinic_id);

  revalidatePath(`/app/agenda/${parsed.data.appointmentId}`);
  revalidatePath("/app/agenda");
  return { ok: true, message: mensajes.agenda.detalle.citaCancelada };
}

export async function reagendarCita(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = rescheduleAppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    newStart: texto(formData, "newStart"),
    newVeterinarianMemberId: texto(formData, "newVeterinarianMemberId"),
    reason: texto(formData, "reason"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: cita } = await supabase
    .from("appointments")
    .select("clinic_id")
    .eq("id", parsed.data.appointmentId)
    .maybeSingle();
  if (!cita) return { ok: false, message: mensajes.comun.errorInesperado };

  const tz = await zonaDeClinica(cita.clinic_id);
  const { error } = await supabase.rpc("reschedule_appointment", {
    p_appointment_id: parsed.data.appointmentId,
    p_new_start: localAUtc(parsed.data.newStart, tz).toISOString(),
    p_new_veterinarian_clinic_member_id: parsed.data.newVeterinarianMemberId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, message: mapearErrorAgenda(error.message) };

  await procesarNotificacionesDeClinica(cita.clinic_id);
  revalidatePath(`/app/agenda/${parsed.data.appointmentId}`);
  revalidatePath("/app/agenda");
  return { ok: true, message: mensajes.agenda.detalle.citaReagendada };
}
