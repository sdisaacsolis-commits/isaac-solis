"use server";

import {
  createPrescriptionDraftSchema,
  discardPrescriptionDraftSchema,
  issuePrescriptionSchema,
  prescriptionItemSchema,
  removePrescriptionItemSchema,
  supersedePrescriptionSchema,
  updatePrescriptionDraftSchema,
  voidPrescriptionSchema,
} from "@dogtoralia/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions de recetas: DELGADAS a propósito. Validan con Zod y delegan
 * los invariantes (permisos, transición de estados, folio, inmutabilidad,
 * snapshots) a RLS y a las RPCs SECURITY DEFINER. Jamás service_role.
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

/** Traduce los códigos estables de RPCs/triggers a mensajes es-MX. */
function mapearErrorReceta(mensaje: string): string {
  const e = mensajes.recetas.errores;
  if (mensaje.includes("PERMISO_DENEGADO")) return e.sinPermiso;
  if (mensaje.includes("RECETA_SIN_PARTIDAS")) return e.sinPartidas;
  if (mensaje.includes("CONSULTA_NO_FINALIZADA")) return e.consultaNoFinalizada;
  if (mensaje.includes("MOTIVO_REQUERIDO")) return e.motivoRequerido;
  if (mensaje.includes("SUSTITUTO_EXISTENTE")) return e.sustitutoExistente;
  if (mensaje.includes("SUSTITUCION_INVALIDA")) return e.sustitucionInvalida;
  if (mensaje.includes("TRANSICION_INVALIDA")) return e.transicionInvalida;
  if (mensaje.includes("RECETA_INMUTABLE")) return e.recetaInmutable;
  if (mensaje.includes("OPERACION_RESERVADA")) return e.recetaInmutable;
  if (mensaje.includes("DOCUMENTO_INMUTABLE")) return e.recetaInmutable;
  if (mensaje.includes("ESTADO_INVALIDO")) return e.estadoInvalido;
  if (mensaje.includes("RECETA_NO_ENCONTRADA")) return e.noEncontrada;
  if (mensaje.includes("CONSULTA_NO_ENCONTRADA")) return e.consultaNoEncontrada;
  if (mensaje.includes("PROPIETARIO_REQUERIDO")) return e.propietarioRequerido;
  if (mensaje.includes("PROPIETARIO_INCONSISTENTE")) return e.propietarioRequerido;
  if (mensaje.includes("MASCOTA_SIN_RELACION")) return e.mascotaSinRelacion;
  if (mensaje.includes("CONSULTA_INCONSISTENTE")) return e.consultaInconsistente;
  if (mensaje.includes("MIEMBRO_NO_VETERINARIO")) return e.miembroNoVeterinario;
  if (mensaje.includes("AUTENTICACION_REQUERIDA")) return e.sinPermiso;
  return mensajes.comun.errorInesperado;
}

function errorAFormState(error: { code?: string; message: string }): FormState {
  if (error.code === "42501") {
    return { ok: false, message: mensajes.recetas.errores.sinPermiso };
  }
  return { ok: false, message: mapearErrorReceta(error.message) };
}

function revalidarReceta(prescriptionId: string): void {
  revalidatePath(`/app/recetas/${prescriptionId}`);
  revalidatePath("/app/recetas");
}

// ---------------------------------------------------------------------------
// Borrador
// ---------------------------------------------------------------------------
export async function crearBorradorReceta(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = createPrescriptionDraftSchema.safeParse({
    encounterId: formData.get("encounterId"),
  });
  if (!parsed.success) return { ok: false, message: mensajes.comun.errorInesperado };

  const supabase = await createClient();
  const { data: prescriptionId, error } = await supabase.rpc("create_prescription_draft", {
    p_encounter_id: parsed.data.encounterId,
  });
  if (error || !prescriptionId) {
    return error ? errorAFormState(error) : { ok: false, message: mensajes.comun.errorInesperado };
  }

  revalidatePath("/app/recetas");
  redirect(`/app/recetas/${prescriptionId}`);
}

export async function actualizarBorradorReceta(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = updatePrescriptionDraftSchema.safeParse({
    prescriptionId: formData.get("prescriptionId"),
    expectedVersion: texto(formData, "expectedVersion"),
    generalInstructions: texto(formData, "generalInstructions"),
    clinicalIndication: texto(formData, "clinicalIndication"),
    validUntil: texto(formData, "validUntil"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  // Control optimista: el trigger bump_version incrementa la versión; si la
  // fila cambió desde que se cargó el formulario, el WHERE no encuentra nada.
  const { data, error } = await supabase
    .from("prescriptions")
    .update({
      general_instructions: parsed.data.generalInstructions ?? null,
      clinical_indication: parsed.data.clinicalIndication ?? null,
      valid_until: parsed.data.validUntil ?? null,
    })
    .eq("id", parsed.data.prescriptionId)
    .eq("version", parsed.data.expectedVersion)
    .select("id");
  if (error) return errorAFormState(error);
  if (!data || data.length === 0) {
    return { ok: false, message: mensajes.recetas.errores.versionObsoleta };
  }

  revalidarReceta(parsed.data.prescriptionId);
  return { ok: true, message: mensajes.recetas.exito.encabezadoGuardado };
}

/** Campos de una partida desde el formulario (compartido por alta y edición). */
function partidaDesdeFormulario(formData: FormData) {
  return {
    prescriptionId: formData.get("prescriptionId"),
    itemId: texto(formData, "itemId"),
    position: texto(formData, "position") ?? "1",
    medicationName: texto(formData, "medicationName"),
    activeIngredient: texto(formData, "activeIngredient"),
    presentation: texto(formData, "presentation"),
    concentration: texto(formData, "concentration"),
    dosageText: texto(formData, "dosageText"),
    routeText: texto(formData, "routeText"),
    frequencyText: texto(formData, "frequencyText"),
    durationText: texto(formData, "durationText"),
    quantityText: texto(formData, "quantityText"),
    instructions: texto(formData, "instructions"),
    startDate: texto(formData, "startDate"),
    endDate: texto(formData, "endDate"),
    asNeeded: formData.get("asNeeded") === "on",
    notes: texto(formData, "notes"),
  };
}

export async function agregarPartida(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = prescriptionItemSchema.safeParse(partidaDesdeFormulario(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("prescription_items").insert({
    prescription_id: parsed.data.prescriptionId,
    position: parsed.data.position,
    medication_name: parsed.data.medicationName,
    active_ingredient: parsed.data.activeIngredient ?? null,
    presentation: parsed.data.presentation ?? null,
    concentration: parsed.data.concentration ?? null,
    dosage_text: parsed.data.dosageText,
    route_text: parsed.data.routeText,
    frequency_text: parsed.data.frequencyText,
    duration_text: parsed.data.durationText,
    quantity_text: parsed.data.quantityText ?? null,
    instructions: parsed.data.instructions ?? null,
    start_date: parsed.data.startDate ?? null,
    end_date: parsed.data.endDate ?? null,
    as_needed: parsed.data.asNeeded,
    notes: parsed.data.notes ?? null,
  });
  if (error) return errorAFormState(error);

  revalidarReceta(parsed.data.prescriptionId);
  return { ok: true, message: mensajes.recetas.exito.partidaAgregada };
}

export async function actualizarPartida(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = prescriptionItemSchema.safeParse(partidaDesdeFormulario(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  if (!parsed.data.itemId) return { ok: false, message: mensajes.comun.errorInesperado };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prescription_items")
    .update({
      position: parsed.data.position,
      medication_name: parsed.data.medicationName,
      active_ingredient: parsed.data.activeIngredient ?? null,
      presentation: parsed.data.presentation ?? null,
      concentration: parsed.data.concentration ?? null,
      dosage_text: parsed.data.dosageText,
      route_text: parsed.data.routeText,
      frequency_text: parsed.data.frequencyText,
      duration_text: parsed.data.durationText,
      quantity_text: parsed.data.quantityText ?? null,
      instructions: parsed.data.instructions ?? null,
      start_date: parsed.data.startDate ?? null,
      end_date: parsed.data.endDate ?? null,
      as_needed: parsed.data.asNeeded,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", parsed.data.itemId)
    .eq("prescription_id", parsed.data.prescriptionId)
    .select("id");
  if (error) return errorAFormState(error);
  if (!data || data.length === 0) {
    return { ok: false, message: mensajes.recetas.errores.sinPermiso };
  }

  revalidarReceta(parsed.data.prescriptionId);
  return { ok: true, message: mensajes.recetas.exito.partidaActualizada };
}

export async function eliminarPartida(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const parsed = removePrescriptionItemSchema.safeParse({
    prescriptionId: formData.get("prescriptionId"),
    itemId: formData.get("itemId"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  // Si RLS no permite (receta emitida o rol sin edición) simplemente no
  // afecta filas — la UI ya oculta el botón.
  await supabase
    .from("prescription_items")
    .delete()
    .eq("id", parsed.data.itemId)
    .eq("prescription_id", parsed.data.prescriptionId);
  revalidarReceta(parsed.data.prescriptionId);
}

// ---------------------------------------------------------------------------
// Emisión, sustitución, anulación y descarte
// ---------------------------------------------------------------------------
export async function emitirReceta(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = issuePrescriptionSchema.safeParse({
    prescriptionId: formData.get("prescriptionId"),
    confirm: formData.get("confirm") === "true",
  });
  if (!parsed.success) {
    return { ok: false, message: mensajes.comun.errorInesperado };
  }

  const supabase = await createClient();
  const { data: folio, error } = await supabase.rpc("issue_prescription", {
    p_prescription_id: parsed.data.prescriptionId,
  });
  if (error || !folio) {
    return error ? errorAFormState(error) : { ok: false, message: mensajes.comun.errorInesperado };
  }

  revalidarReceta(parsed.data.prescriptionId);
  return { ok: true, message: mensajes.recetas.exito.emitida(folio) };
}

export async function sustituirReceta(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = supersedePrescriptionSchema.safeParse({
    prescriptionId: formData.get("prescriptionId"),
    reason: texto(formData, "reason"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: nuevaId, error } = await supabase.rpc("supersede_prescription", {
    p_prescription_id: parsed.data.prescriptionId,
    p_reason: parsed.data.reason,
  });
  if (error || !nuevaId) {
    return error ? errorAFormState(error) : { ok: false, message: mensajes.comun.errorInesperado };
  }

  revalidarReceta(parsed.data.prescriptionId);
  redirect(`/app/recetas/${nuevaId}`);
}

export async function anularReceta(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = voidPrescriptionSchema.safeParse({
    prescriptionId: formData.get("prescriptionId"),
    reason: texto(formData, "reason"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_prescription", {
    p_prescription_id: parsed.data.prescriptionId,
    p_reason: parsed.data.reason,
  });
  if (error) return errorAFormState(error);

  revalidarReceta(parsed.data.prescriptionId);
  return { ok: true, message: mensajes.recetas.exito.anulada };
}

export async function descartarBorrador(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = discardPrescriptionDraftSchema.safeParse({
    prescriptionId: formData.get("prescriptionId"),
  });
  if (!parsed.success) return { ok: false, message: mensajes.comun.errorInesperado };

  const supabase = await createClient();
  const { error } = await supabase.rpc("discard_prescription_draft", {
    p_prescription_id: parsed.data.prescriptionId,
  });
  if (error) return errorAFormState(error);

  revalidatePath("/app/recetas");
  redirect("/app/recetas");
}

/** Bitácora de impresión (mejor esfuerzo; nunca bloquea la impresión). */
export async function registrarImpresionReceta(prescriptionId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const parsed = z.string().uuid().safeParse(prescriptionId);
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.rpc("log_prescription_access", {
    p_prescription_id: parsed.data,
    p_access_type: "print",
  });
}
