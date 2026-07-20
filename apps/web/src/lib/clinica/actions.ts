"use server";

import { randomUUID } from "node:crypto";

import {
  addendumSchema,
  CLINICAL_FILE_MIME_TYPES,
  clinicalFileSchema,
  diagnosisSchema,
  encounterHeaderSchema,
  examinationSchema,
  followUpSchema,
  soapNoteSchema,
  startEncounterSchema,
  treatmentSchema,
  vitalsSchema,
  voidEncounterSchema,
  walkInEncounterSchema,
} from "@dogtoralia/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/env";
import type { FormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions del expediente clínico: DELGADAS a propósito. Validan con
 * Zod y delegan los invariantes (permisos, transición de estados, requisitos
 * de finalización, inmutabilidad) a RLS y a las RPCs SECURITY DEFINER.
 * Jamás service_role: el cliente del usuario es quien firma cada operación.
 */

const BUCKET_ARCHIVOS_CLINICOS = "clinical-files";

function sinSupabase(): FormState {
  return { ok: false, message: mensajes.comun.supabaseNoConfigurado };
}

function texto(formData: FormData, campo: string): string | undefined {
  const v = formData.get(campo);
  if (typeof v !== "string") return undefined;
  const limpio = v.trim();
  return limpio === "" ? undefined : limpio;
}

/** Traduce los códigos estables de RPCs/triggers a mensajes es-MX. */
function mapearErrorClinica(mensaje: string): string {
  const e = mensajes.consultas.errores;
  if (mensaje.includes("PERMISO_DENEGADO")) return e.sinPermiso;
  if (mensaje.includes("FALTA_MOTIVO")) return e.faltaMotivo;
  if (mensaje.includes("NOTA_INCOMPLETA")) return e.notaIncompleta;
  if (mensaje.includes("FALTA_EXPLORACION")) return e.faltaExploracion;
  if (mensaje.includes("FALTAN_VITALES")) return e.faltanVitales;
  if (mensaje.includes("TRANSICION_INVALIDA")) return e.transicionInvalida;
  if (mensaje.includes("MOTIVO_REQUERIDO")) return e.motivoRequerido;
  if (mensaje.includes("CONSULTA_INMUTABLE")) return e.consultaInmutable;
  if (mensaje.includes("ADENDA_INVALIDA")) return e.adendaInvalida;
  if (mensaje.includes("MASCOTA_SIN_RELACION")) return e.mascotaSinRelacion;
  if (mensaje.includes("ESTADO_INVALIDO")) return e.estadoInvalido;
  if (mensaje.includes("CITA_INCONSISTENTE")) return e.citaInconsistente;
  return mensajes.comun.errorInesperado;
}

function errorAFormState(error: { code?: string; message: string }): FormState {
  if (error.code === "42501") {
    return { ok: false, message: mensajes.consultas.errores.sinPermiso };
  }
  return { ok: false, message: mapearErrorClinica(error.message) };
}

/** Cabecera mínima de la consulta (visible para todo el personal de la clínica). */
async function cabeceraDeConsulta(encounterId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clinical_encounters")
    .select("id, clinic_id, organization_id, pet_id, status")
    .eq("id", encounterId)
    .maybeSingle();
  return data ?? null;
}

/** Usuario actual y su membresía activa en la clínica (para columnas *_by). */
async function actorEnClinica(
  clinicId: string,
): Promise<{ userId: string | null; memberId: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, memberId: null };
  const { data } = await supabase
    .from("clinic_members")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  return { userId: user.id, memberId: data?.id ?? null };
}

function revalidarConsulta(encounterId: string): void {
  revalidatePath(`/app/consultas/${encounterId}`);
  revalidatePath("/app/consultas");
}

// ---------------------------------------------------------------------------
// Apertura de consultas
// ---------------------------------------------------------------------------
export async function iniciarConsultaDesdeCita(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = startEncounterSchema.safeParse({ appointmentId: formData.get("appointmentId") });
  if (!parsed.success) return { ok: false, message: mensajes.comun.errorInesperado };

  const supabase = await createClient();
  const { data: encounterId, error } = await supabase.rpc("start_encounter_from_appointment", {
    p_appointment_id: parsed.data.appointmentId,
  });
  if (error || !encounterId) {
    return error ? errorAFormState(error) : { ok: false, message: mensajes.comun.errorInesperado };
  }

  revalidatePath("/app/consultas");
  revalidatePath("/app/agenda");
  revalidatePath(`/app/agenda/${parsed.data.appointmentId}`);
  redirect(`/app/consultas/${encounterId}`);
}

export async function crearConsultaWalkIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  // El select de paciente entrega "petId|ownerId" (mismo patrón de agenda).
  const [petId, ownerId] = (texto(formData, "paciente") ?? "").split("|");
  const parsed = walkInEncounterSchema.safeParse({
    clinicId: formData.get("clinicId"),
    petId,
    ownerId,
    veterinarianMemberId: texto(formData, "veterinarianMemberId"),
    serviceIds: formData.getAll("serviceIds").map(String).filter(Boolean),
    encounterType: texto(formData, "encounterType") ?? "walk_in",
    chiefComplaint: texto(formData, "chiefComplaint"),
    emergencyReason: texto(formData, "emergencyReason"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: encounterId, error } = await supabase.rpc("create_walk_in_encounter", {
    p_clinic_id: parsed.data.clinicId,
    p_pet_id: parsed.data.petId,
    p_owner_id: parsed.data.ownerId,
    p_veterinarian_clinic_member_id: parsed.data.veterinarianMemberId,
    p_service_ids: parsed.data.serviceIds,
    p_encounter_type: parsed.data.encounterType,
    p_chief_complaint: parsed.data.chiefComplaint,
    p_emergency_reason: parsed.data.emergencyReason,
  });
  if (error || !encounterId) {
    return error ? errorAFormState(error) : { ok: false, message: mensajes.comun.errorInesperado };
  }

  revalidatePath("/app/consultas");
  revalidatePath("/app/agenda");
  redirect(`/app/consultas/${encounterId}`);
}

// ---------------------------------------------------------------------------
// Contenido de la consulta abierta
// ---------------------------------------------------------------------------
export async function guardarCabecera(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = encounterHeaderSchema.safeParse({
    encounterId: formData.get("encounterId"),
    chiefComplaint: texto(formData, "chiefComplaint"),
    vitalsSkippedReason: texto(formData, "vitalsSkippedReason"),
    examinationSkippedReason: texto(formData, "examinationSkippedReason"),
    internalNotes: texto(formData, "internalNotes"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinical_encounters")
    .update({
      chief_complaint: parsed.data.chiefComplaint ?? null,
      vitals_skipped_reason: parsed.data.vitalsSkippedReason ?? null,
      examination_skipped_reason: parsed.data.examinationSkippedReason ?? null,
      internal_notes: parsed.data.internalNotes ?? null,
    })
    .eq("id", parsed.data.encounterId)
    .select("id");
  if (error) return errorAFormState(error);
  if (!data || data.length === 0) {
    return { ok: false, message: mensajes.consultas.errores.sinPermiso };
  }

  revalidarConsulta(parsed.data.encounterId);
  return { ok: true, message: mensajes.consultas.exito.cabeceraGuardada };
}

export async function guardarNota(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = soapNoteSchema.safeParse({
    encounterId: formData.get("encounterId"),
    expectedVersion: texto(formData, "expectedVersion"),
    historySummary: texto(formData, "historySummary"),
    subjective: texto(formData, "subjective"),
    objective: texto(formData, "objective"),
    assessment: texto(formData, "assessment"),
    plan: texto(formData, "plan"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const cabecera = await cabeceraDeConsulta(parsed.data.encounterId);
  if (!cabecera) return { ok: false, message: mensajes.comun.errorInesperado };
  const { memberId } = await actorEnClinica(cabecera.clinic_id);

  const supabase = await createClient();
  const contenido = {
    history_summary: parsed.data.historySummary ?? null,
    subjective: parsed.data.subjective ?? null,
    objective: parsed.data.objective ?? null,
    assessment: parsed.data.assessment ?? null,
    plan: parsed.data.plan ?? null,
    author_clinic_member_id: memberId,
  };

  if (parsed.data.expectedVersion !== undefined) {
    // Control optimista: el trigger bump_version incrementa la versión; si la
    // fila cambió desde que se cargó el formulario, el WHERE no encuentra nada.
    const { data, error } = await supabase
      .from("clinical_notes")
      .update(contenido)
      .eq("encounter_id", parsed.data.encounterId)
      .eq("version", parsed.data.expectedVersion)
      .select("id");
    if (error) return errorAFormState(error);
    if (!data || data.length === 0) {
      return { ok: false, message: mensajes.consultas.errores.versionObsoleta };
    }
  } else {
    const { error } = await supabase
      .from("clinical_notes")
      .insert({ encounter_id: parsed.data.encounterId, ...contenido });
    if (error) {
      // 23505: otra pestaña creó la nota mientras tanto → conflicto de versión.
      if (error.code === "23505") {
        return { ok: false, message: mensajes.consultas.errores.versionObsoleta };
      }
      return errorAFormState(error);
    }
  }

  revalidarConsulta(parsed.data.encounterId);
  return { ok: true, message: mensajes.consultas.exito.notaGuardada };
}

export async function guardarExploracion(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = examinationSchema.safeParse({
    encounterId: formData.get("encounterId"),
    expectedVersion: texto(formData, "expectedVersion"),
    generalCondition: texto(formData, "generalCondition"),
    attitude: texto(formData, "attitude"),
    bodyCondition: texto(formData, "bodyCondition"),
    skinAndCoat: texto(formData, "skinAndCoat"),
    eyes: texto(formData, "eyes"),
    ears: texto(formData, "ears"),
    oralCavity: texto(formData, "oralCavity"),
    cardiovascular: texto(formData, "cardiovascular"),
    respiratory: texto(formData, "respiratory"),
    digestive: texto(formData, "digestive"),
    urinary: texto(formData, "urinary"),
    musculoskeletal: texto(formData, "musculoskeletal"),
    neurological: texto(formData, "neurological"),
    lymphNodes: texto(formData, "lymphNodes"),
    observations: texto(formData, "observations"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const cabecera = await cabeceraDeConsulta(parsed.data.encounterId);
  if (!cabecera) return { ok: false, message: mensajes.comun.errorInesperado };
  const { memberId } = await actorEnClinica(cabecera.clinic_id);

  const supabase = await createClient();
  const contenido = {
    general_condition: parsed.data.generalCondition ?? null,
    attitude: parsed.data.attitude ?? null,
    body_condition: parsed.data.bodyCondition ?? null,
    skin_and_coat: parsed.data.skinAndCoat ?? null,
    eyes: parsed.data.eyes ?? null,
    ears: parsed.data.ears ?? null,
    oral_cavity: parsed.data.oralCavity ?? null,
    cardiovascular: parsed.data.cardiovascular ?? null,
    respiratory: parsed.data.respiratory ?? null,
    digestive: parsed.data.digestive ?? null,
    urinary: parsed.data.urinary ?? null,
    musculoskeletal: parsed.data.musculoskeletal ?? null,
    neurological: parsed.data.neurological ?? null,
    lymph_nodes: parsed.data.lymphNodes ?? null,
    observations: parsed.data.observations ?? null,
    examined_by: memberId,
  };

  if (parsed.data.expectedVersion !== undefined) {
    const { data, error } = await supabase
      .from("encounter_examinations")
      .update(contenido)
      .eq("encounter_id", parsed.data.encounterId)
      .eq("version", parsed.data.expectedVersion)
      .select("id");
    if (error) return errorAFormState(error);
    if (!data || data.length === 0) {
      return { ok: false, message: mensajes.consultas.errores.versionObsoleta };
    }
  } else {
    const { error } = await supabase
      .from("encounter_examinations")
      .insert({ encounter_id: parsed.data.encounterId, ...contenido });
    if (error) {
      if (error.code === "23505") {
        return { ok: false, message: mensajes.consultas.errores.versionObsoleta };
      }
      return errorAFormState(error);
    }
  }

  revalidarConsulta(parsed.data.encounterId);
  return { ok: true, message: mensajes.consultas.exito.exploracionGuardada };
}

export async function registrarVitales(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = vitalsSchema.safeParse({
    encounterId: formData.get("encounterId"),
    weightKg: texto(formData, "weightKg"),
    temperatureC: texto(formData, "temperatureC"),
    heartRateBpm: texto(formData, "heartRateBpm"),
    respiratoryRateBpm: texto(formData, "respiratoryRateBpm"),
    capillaryRefillSeconds: texto(formData, "capillaryRefillSeconds"),
    bodyConditionScore: texto(formData, "bodyConditionScore"),
    painScore: texto(formData, "painScore"),
    hydrationStatus: texto(formData, "hydrationStatus"),
    mucousMembranes: texto(formData, "mucousMembranes"),
    bloodPressureSystolic: texto(formData, "bloodPressureSystolic"),
    bloodPressureDiastolic: texto(formData, "bloodPressureDiastolic"),
    notes: texto(formData, "notes"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const cabecera = await cabeceraDeConsulta(parsed.data.encounterId);
  if (!cabecera) return { ok: false, message: mensajes.comun.errorInesperado };
  const { memberId } = await actorEnClinica(cabecera.clinic_id);

  const supabase = await createClient();
  const { error } = await supabase.from("clinical_vitals").insert({
    encounter_id: parsed.data.encounterId,
    recorded_by: memberId,
    weight_kg: parsed.data.weightKg ?? null,
    temperature_c: parsed.data.temperatureC ?? null,
    heart_rate_bpm: parsed.data.heartRateBpm ?? null,
    respiratory_rate_bpm: parsed.data.respiratoryRateBpm ?? null,
    capillary_refill_seconds: parsed.data.capillaryRefillSeconds ?? null,
    body_condition_score: parsed.data.bodyConditionScore ?? null,
    pain_score: parsed.data.painScore ?? null,
    hydration_status: parsed.data.hydrationStatus ?? null,
    mucous_membranes: parsed.data.mucousMembranes ?? null,
    blood_pressure_systolic: parsed.data.bloodPressureSystolic ?? null,
    blood_pressure_diastolic: parsed.data.bloodPressureDiastolic ?? null,
    notes: parsed.data.notes ?? null,
  });
  if (error) return errorAFormState(error);

  revalidarConsulta(parsed.data.encounterId);
  return { ok: true, message: mensajes.consultas.exito.vitalesRegistrados };
}

// ---------------------------------------------------------------------------
// Diagnósticos, tratamientos y seguimiento
// ---------------------------------------------------------------------------
export async function agregarDiagnostico(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = diagnosisSchema.safeParse({
    encounterId: formData.get("encounterId"),
    name: texto(formData, "name"),
    description: texto(formData, "description"),
    certainty: texto(formData, "certainty") ?? "presumptive",
    isPrimary: formData.get("isPrimary") === "on",
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const cabecera = await cabeceraDeConsulta(parsed.data.encounterId);
  if (!cabecera) return { ok: false, message: mensajes.comun.errorInesperado };
  const { memberId } = await actorEnClinica(cabecera.clinic_id);

  const supabase = await createClient();
  const { error } = await supabase.from("diagnoses").insert({
    encounter_id: parsed.data.encounterId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    certainty: parsed.data.certainty,
    is_primary: parsed.data.isPrimary,
    diagnosed_by: memberId,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: mensajes.consultas.errores.diagnosticoPrincipalDuplicado };
    }
    return errorAFormState(error);
  }

  revalidarConsulta(parsed.data.encounterId);
  return { ok: true, message: mensajes.consultas.exito.diagnosticoAgregado };
}

export async function quitarDiagnostico(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const parsed = z
    .object({ diagnosisId: z.string().uuid(), encounterId: z.string().uuid() })
    .safeParse({
      diagnosisId: formData.get("diagnosisId"),
      encounterId: formData.get("encounterId"),
    });
  if (!parsed.success) return;

  const supabase = await createClient();
  // Retiro por soft-delete; si RLS no permite (consulta cerrada o rol sin
  // edición) simplemente no afecta filas — la UI ya oculta el botón.
  await supabase
    .from("diagnoses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.diagnosisId)
    .is("deleted_at", null);
  revalidarConsulta(parsed.data.encounterId);
}

export async function agregarTratamiento(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = treatmentSchema.safeParse({
    encounterId: formData.get("encounterId"),
    treatmentType: texto(formData, "treatmentType") ?? "medication_recommendation",
    name: texto(formData, "name"),
    instructions: texto(formData, "instructions"),
    dosageText: texto(formData, "dosageText"),
    routeText: texto(formData, "routeText"),
    frequencyText: texto(formData, "frequencyText"),
    durationText: texto(formData, "durationText"),
    performedDuringEncounter: formData.get("performedDuringEncounter") === "on",
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const cabecera = await cabeceraDeConsulta(parsed.data.encounterId);
  if (!cabecera) return { ok: false, message: mensajes.comun.errorInesperado };
  const { userId } = await actorEnClinica(cabecera.clinic_id);

  const supabase = await createClient();
  const { error } = await supabase.from("encounter_treatments").insert({
    encounter_id: parsed.data.encounterId,
    treatment_type: parsed.data.treatmentType,
    name: parsed.data.name,
    instructions: parsed.data.instructions ?? null,
    dosage_text: parsed.data.dosageText ?? null,
    route_text: parsed.data.routeText ?? null,
    frequency_text: parsed.data.frequencyText ?? null,
    duration_text: parsed.data.durationText ?? null,
    performed_during_encounter: parsed.data.performedDuringEncounter,
    created_by: userId,
  });
  if (error) return errorAFormState(error);

  revalidarConsulta(parsed.data.encounterId);
  return { ok: true, message: mensajes.consultas.exito.tratamientoAgregado };
}

export async function quitarTratamiento(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const parsed = z
    .object({ treatmentId: z.string().uuid(), encounterId: z.string().uuid() })
    .safeParse({
      treatmentId: formData.get("treatmentId"),
      encounterId: formData.get("encounterId"),
    });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("encounter_treatments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.treatmentId)
    .is("deleted_at", null);
  revalidarConsulta(parsed.data.encounterId);
}

export async function agregarSeguimiento(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = followUpSchema.safeParse({
    encounterId: formData.get("encounterId"),
    reason: texto(formData, "reason"),
    recommendedWithinDays: texto(formData, "recommendedWithinDays"),
    serviceId: texto(formData, "serviceId"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("encounter_follow_ups").insert({
    encounter_id: parsed.data.encounterId,
    reason: parsed.data.reason,
    recommended_within_days: parsed.data.recommendedWithinDays ?? null,
    service_id: parsed.data.serviceId ?? null,
  });
  if (error) return errorAFormState(error);

  revalidarConsulta(parsed.data.encounterId);
  return { ok: true, message: mensajes.consultas.exito.seguimientoAgregado };
}

// ---------------------------------------------------------------------------
// Archivos clínicos (bucket privado; el MIME se verifica por contenido real)
// ---------------------------------------------------------------------------
type MimeClinico = (typeof CLINICAL_FILE_MIME_TYPES)[number];

const EXTENSION_POR_MIME: Record<MimeClinico, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Detecta el tipo REAL por firma binaria; la cabecera declarada no es confiable. */
function detectarMimePorContenido(buffer: Buffer): MimeClinico | null {
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("latin1") === "%PDF") {
    return "application/pdf";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
    buffer.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function subirArchivoClinico(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();
  const e = mensajes.consultas.errores;

  const parsed = clinicalFileSchema.safeParse({
    encounterId: formData.get("encounterId"),
    kind: texto(formData, "kind") ?? "other",
    description: texto(formData, "description"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const archivo = formData.get("file");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, message: e.archivoVacio };
  }
  const maxBytes = env.CLINICAL_FILE_MAX_MB * 1024 * 1024;
  if (archivo.size > maxBytes) {
    return { ok: false, message: e.archivoMuyGrande(env.CLINICAL_FILE_MAX_MB) };
  }
  if (!(CLINICAL_FILE_MIME_TYPES as readonly string[]).includes(archivo.type)) {
    return { ok: false, message: e.archivoTipoInvalido };
  }
  const contenido = Buffer.from(await archivo.arrayBuffer());
  const mimeReal = detectarMimePorContenido(contenido);
  if (!mimeReal) {
    return { ok: false, message: e.archivoContenidoInvalido };
  }

  const cabecera = await cabeceraDeConsulta(parsed.data.encounterId);
  if (!cabecera) return { ok: false, message: mensajes.comun.errorInesperado };
  const { userId } = await actorEnClinica(cabecera.clinic_id);

  // Ruta interna con UUID aleatorio (jamás el nombre del usuario); las
  // políticas de Storage validan encounter y rol con el cliente del usuario.
  const ruta = `pets/${cabecera.pet_id}/encounters/${cabecera.id}/${randomUUID()}.${EXTENSION_POR_MIME[mimeReal]}`;

  const supabase = await createClient();
  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_ARCHIVOS_CLINICOS)
    .upload(ruta, contenido, { contentType: mimeReal, upsert: false });
  if (errorSubida) {
    return { ok: false, message: e.sinPermiso };
  }

  const { error: errorInsert } = await supabase.from("clinical_files").insert({
    organization_id: cabecera.organization_id,
    clinic_id: cabecera.clinic_id,
    pet_id: cabecera.pet_id,
    encounter_id: cabecera.id,
    storage_path: ruta,
    original_filename: archivo.name,
    mime_type: mimeReal,
    size_bytes: archivo.size,
    kind: parsed.data.kind,
    description: parsed.data.description ?? null,
    uploaded_by: userId,
  });
  if (errorInsert) {
    // Mejor esfuerzo: sin metadata el binario queda huérfano e inaccesible.
    await supabase.storage.from(BUCKET_ARCHIVOS_CLINICOS).remove([ruta]);
    return errorAFormState(errorInsert);
  }

  revalidarConsulta(parsed.data.encounterId);
  return { ok: true, message: mensajes.consultas.exito.archivoSubido };
}

/** Registra el acceso (bitácora) y redirige a una URL firmada de corta vida. */
export async function descargarArchivoClinico(formData: FormData): Promise<void> {
  const parsed = z.string().uuid().safeParse(formData.get("fileId"));
  if (!isSupabaseConfigured() || !parsed.success) redirect("/app/consultas");

  const supabase = await createClient();
  const { data: archivo } = await supabase
    .from("clinical_files")
    .select("encounter_id, storage_path")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!archivo) redirect("/app/consultas");

  // Bitácora de descarga: mejor esfuerzo, nunca bloquea la descarga.
  await supabase.rpc("log_clinical_record_access", {
    p_encounter_id: archivo.encounter_id,
    p_access_type: "file_download",
  });

  const { data: firmada } = await supabase.storage
    .from(BUCKET_ARCHIVOS_CLINICOS)
    .createSignedUrl(archivo.storage_path, env.CLINICAL_FILE_SIGNED_URL_SECONDS);
  if (!firmada?.signedUrl) {
    redirect(`/app/consultas/${archivo.encounter_id}?archivo=error`);
  }
  redirect(firmada.signedUrl);
}

// ---------------------------------------------------------------------------
// Finalización, adendas y anulación
// ---------------------------------------------------------------------------
export async function finalizarConsulta(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const encounterId = z.string().uuid().safeParse(formData.get("encounterId"));
  if (!encounterId.success) return { ok: false, message: mensajes.comun.errorInesperado };

  const supabase = await createClient();
  const { error } = await supabase.rpc("finalize_clinical_encounter", {
    p_encounter_id: encounterId.data,
  });
  if (error) return errorAFormState(error);

  revalidarConsulta(encounterId.data);
  revalidatePath("/app/agenda");
  return { ok: true, message: mensajes.consultas.exito.consultaFinalizada };
}

export async function crearAdenda(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = addendumSchema.safeParse({
    encounterId: formData.get("encounterId"),
    content: texto(formData, "content"),
    reason: texto(formData, "reason"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("encounter_addenda").insert({
    encounter_id: parsed.data.encounterId,
    content: parsed.data.content,
    reason: parsed.data.reason,
    created_by: user?.id ?? null,
  });
  if (error) return errorAFormState(error);

  revalidarConsulta(parsed.data.encounterId);
  return { ok: true, message: mensajes.consultas.exito.adendaCreada };
}

export async function anularConsulta(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = voidEncounterSchema.safeParse({
    encounterId: formData.get("encounterId"),
    reason: texto(formData, "reason"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_clinical_encounter", {
    p_encounter_id: parsed.data.encounterId,
    p_reason: parsed.data.reason,
  });
  if (error) return errorAFormState(error);

  revalidarConsulta(parsed.data.encounterId);
  return { ok: true, message: mensajes.consultas.exito.consultaAnulada };
}

/** Bitácora de impresión (mejor esfuerzo; nunca bloquea la impresión). */
export async function registrarAccesoImpresion(encounterId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const parsed = z.string().uuid().safeParse(encounterId);
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.rpc("log_clinical_record_access", {
    p_encounter_id: parsed.data,
    p_access_type: "print",
  });
}
