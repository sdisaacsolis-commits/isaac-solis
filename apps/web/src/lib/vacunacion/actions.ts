"use server";

import { randomUUID } from "node:crypto";

import {
  recordHistoricalVaccinationSchema,
  recordVaccinationSchema,
  VACCINATION_FILE_MIME_TYPES,
  vaccineCatalogSchema,
  voidVaccinationSchema,
} from "@dogtoralia/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/env";
import { detectarMimePorContenido, EXTENSION_POR_MIME } from "@/lib/archivos/mime";
import type { FormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { procesarNotificacionesVacunacionDeClinica } from "@/lib/vacunacion/notificaciones";

/**
 * Server Actions de vacunación: DELGADAS a propósito. Validan con Zod y
 * delegan los invariantes (rol veterinario, lote/caducidad, fechas,
 * inmutabilidad, idempotencia) a RLS y a las RPCs SECURITY DEFINER.
 * Jamás service_role: el cliente del usuario firma cada operación.
 */

const BUCKET_VACUNACION = "vaccination-files";

function sinSupabase(): FormState {
  return { ok: false, message: mensajes.comun.supabaseNoConfigurado };
}

function texto(formData: FormData, campo: string): string | undefined {
  const v = formData.get(campo);
  if (typeof v !== "string") return undefined;
  const limpio = v.trim();
  return limpio === "" ? undefined : limpio;
}

/** "moquillo, rabia" → ["moquillo", "rabia"] (lista editable por el usuario). */
function listaDesdeTexto(valor: string | undefined): string[] | undefined {
  if (!valor) return undefined;
  const lista = valor
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return lista.length > 0 ? lista : undefined;
}

/** Traduce los códigos estables de RPCs/triggers a mensajes es-MX. */
function mapearErrorVacunacion(mensaje: string): string {
  const e = mensajes.vacunacion.errores;
  if (mensaje.includes("PROXIMA_DOSIS_SOLO_VETERINARIO")) return e.proximaSoloVeterinario;
  if (mensaje.includes("PERMISO_DENEGADO")) return e.sinPermiso;
  if (mensaje.includes("LOTE_REQUERIDO")) return e.loteRequerido;
  if (mensaje.includes("CADUCIDAD_REQUERIDA")) return e.caducidadRequerida;
  if (mensaje.includes("PRODUCTO_CADUCADO")) return e.productoCaducado;
  if (mensaje.includes("FECHA_INVALIDA")) return e.fechaInvalida;
  if (mensaje.includes("VACUNACION_INMUTABLE")) return e.vacunacionInmutable;
  if (mensaje.includes("MASCOTA_SIN_RELACION")) return e.mascotaSinRelacion;
  if (mensaje.includes("VACUNA_REQUERIDA")) return e.vacunaRequerida;
  if (mensaje.includes("PRODUCTO_NO_ENCONTRADO")) return e.productoNoEncontrado;
  if (mensaje.includes("CATALOGO_INCONSISTENTE")) return e.catalogoInconsistente;
  if (mensaje.includes("FUENTE_INVALIDA")) return e.fuenteInvalida;
  if (mensaje.includes("MOTIVO_REQUERIDO")) return e.motivoRequerido;
  if (mensaje.includes("TRANSICION_INVALIDA")) return e.transicionInvalida;
  if (mensaje.includes("MIEMBRO_NO_VETERINARIO")) return e.miembroNoVeterinario;
  if (mensaje.includes("REGISTRO_NO_ENCONTRADO")) return e.registroNoEncontrado;
  if (mensaje.includes("RUTA_INVALIDA")) return e.rutaInvalida;
  if (mensaje.includes("CONSULTA_INCONSISTENTE")) return e.mascotaSinRelacion;
  if (mensaje.includes("AUTENTICACION_REQUERIDA")) return e.sinPermiso;
  return mensajes.comun.errorInesperado;
}

function errorAFormState(error: { code?: string; message: string }): FormState {
  if (error.code === "42501") {
    return { ok: false, message: mensajes.vacunacion.errores.sinPermiso };
  }
  return { ok: false, message: mapearErrorVacunacion(error.message) };
}

function revalidarVacunacion(recordId?: string, petId?: string): void {
  revalidatePath("/app/vacunacion");
  if (recordId) revalidatePath(`/app/vacunacion/${recordId}`);
  if (petId) revalidatePath(`/app/mascotas/${petId}/vacunacion`);
  revalidatePath("/app/inicio");
}

// ---------------------------------------------------------------------------
// Registro de vacunas
// ---------------------------------------------------------------------------
export async function registrarVacunaAplicada(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = recordVaccinationSchema.safeParse({
    clinicId: formData.get("clinicId"),
    petId: texto(formData, "petId"),
    encounterId: texto(formData, "encounterId"),
    vaccineCatalogId: texto(formData, "vaccineCatalogId"),
    vaccineName: texto(formData, "vaccineName"),
    manufacturer: texto(formData, "manufacturer"),
    diseases: listaDesdeTexto(texto(formData, "diseases")),
    lotNumber: texto(formData, "lotNumber"),
    lotMissingReason: texto(formData, "lotMissingReason"),
    expirationDate: texto(formData, "expirationDate"),
    routeText: texto(formData, "routeText"),
    applicationSite: texto(formData, "applicationSite"),
    doseText: texto(formData, "doseText"),
    nextDueAt: texto(formData, "nextDueAt"),
    notes: texto(formData, "notes"),
    requestId: texto(formData, "requestId"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: recordId, error } = await supabase.rpc("record_vaccination", {
    p_clinic_id: parsed.data.clinicId,
    p_pet_id: parsed.data.petId,
    p_encounter_id: parsed.data.encounterId,
    p_vaccine_catalog_id: parsed.data.vaccineCatalogId,
    p_vaccine_name: parsed.data.vaccineName,
    p_manufacturer: parsed.data.manufacturer,
    p_diseases: parsed.data.diseases,
    p_lot_number: parsed.data.lotNumber,
    p_lot_missing_reason: parsed.data.lotMissingReason,
    p_expiration_date: parsed.data.expirationDate,
    p_route_text: parsed.data.routeText,
    p_application_site: parsed.data.applicationSite,
    p_dose_text: parsed.data.doseText,
    p_next_due_at: parsed.data.nextDueAt,
    p_notes: parsed.data.notes,
    p_request_id: parsed.data.requestId,
  });
  if (error || !recordId) {
    return error ? errorAFormState(error) : { ok: false, message: mensajes.comun.errorInesperado };
  }

  // Procesamiento oportunista del outbox (mismo patrón que la agenda).
  await procesarNotificacionesVacunacionDeClinica(parsed.data.clinicId);

  revalidarVacunacion(recordId, parsed.data.petId);
  redirect(`/app/vacunacion/${recordId}`);
}

export async function registrarVacunaHistorica(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();
  const e = mensajes.vacunacion.errores;

  const parsed = recordHistoricalVaccinationSchema.safeParse({
    clinicId: formData.get("clinicId"),
    petId: texto(formData, "petId"),
    source: texto(formData, "source") ?? "historical_owner_document",
    vaccineName: texto(formData, "vaccineName"),
    administeredOn: texto(formData, "administeredOn"),
    manufacturer: texto(formData, "manufacturer"),
    diseases: listaDesdeTexto(texto(formData, "diseases")),
    lotNumber: texto(formData, "lotNumber"),
    expirationDate: texto(formData, "expirationDate"),
    nextDueAt: texto(formData, "nextDueAt"),
    providerName: texto(formData, "providerName"),
    documentReference: texto(formData, "documentReference"),
    notes: texto(formData, "notes"),
    requestId: texto(formData, "requestId"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  // Comprobante opcional: bucket privado, ruta generada en SERVIDOR con UUID y
  // tipo MIME verificado por contenido real (magic bytes), jamás por cabecera.
  let rutaComprobante: string | undefined;
  const archivo = formData.get("file");
  if (archivo instanceof File && archivo.size > 0) {
    const maxBytes = env.CLINICAL_FILE_MAX_MB * 1024 * 1024;
    if (archivo.size > maxBytes) {
      return { ok: false, message: e.archivoMuyGrande(env.CLINICAL_FILE_MAX_MB) };
    }
    if (!(VACCINATION_FILE_MIME_TYPES as readonly string[]).includes(archivo.type)) {
      return { ok: false, message: e.archivoTipoInvalido };
    }
    const contenido = Buffer.from(await archivo.arrayBuffer());
    const mimeReal = detectarMimePorContenido(contenido);
    if (!mimeReal) {
      return { ok: false, message: e.archivoContenidoInvalido };
    }

    rutaComprobante = `pets/${parsed.data.petId}/vaccinations/${randomUUID()}.${EXTENSION_POR_MIME[mimeReal]}`;
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET_VACUNACION)
      .upload(rutaComprobante, contenido, { contentType: mimeReal, upsert: false });
    if (errorSubida) {
      return { ok: false, message: e.sinPermiso };
    }
  }

  const { data: recordId, error } = await supabase.rpc("record_historical_vaccination", {
    p_clinic_id: parsed.data.clinicId,
    p_pet_id: parsed.data.petId,
    p_source: parsed.data.source,
    p_vaccine_name: parsed.data.vaccineName,
    p_administered_on: parsed.data.administeredOn,
    p_manufacturer: parsed.data.manufacturer,
    p_diseases: parsed.data.diseases,
    p_lot_number: parsed.data.lotNumber,
    p_expiration_date: parsed.data.expirationDate,
    p_next_due_at: parsed.data.nextDueAt,
    p_provider_name: parsed.data.providerName,
    p_document_reference: parsed.data.documentReference,
    p_document_path: rutaComprobante,
    p_notes: parsed.data.notes,
    p_request_id: parsed.data.requestId,
  });
  if (error || !recordId) {
    // Mejor esfuerzo: sin registro, el binario quedaría huérfano.
    if (rutaComprobante) {
      await supabase.storage.from(BUCKET_VACUNACION).remove([rutaComprobante]);
    }
    return error ? errorAFormState(error) : { ok: false, message: mensajes.comun.errorInesperado };
  }

  if (parsed.data.nextDueAt) {
    await procesarNotificacionesVacunacionDeClinica(parsed.data.clinicId);
  }

  revalidarVacunacion(recordId, parsed.data.petId);
  redirect(`/app/vacunacion/${recordId}`);
}

export async function anularVacunacion(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = voidVaccinationSchema.safeParse({
    recordId: formData.get("recordId"),
    reason: texto(formData, "reason"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_vaccination_record", {
    p_record_id: parsed.data.recordId,
    p_reason: parsed.data.reason,
  });
  if (error) return errorAFormState(error);

  revalidarVacunacion(parsed.data.recordId, texto(formData, "petId"));
  return { ok: true, message: mensajes.vacunacion.exito.anulada };
}

// ---------------------------------------------------------------------------
// Catálogo de vacunas (contenido no clínico; RLS decide quién administra)
// ---------------------------------------------------------------------------
function catalogoDesdeFormulario(formData: FormData) {
  return {
    catalogId: texto(formData, "catalogId"),
    name: texto(formData, "name"),
    manufacturer: texto(formData, "manufacturer"),
    targetSpecies: formData.getAll("targetSpecies").map(String).filter(Boolean),
    diseasesCovered: listaDesdeTexto(texto(formData, "diseasesCovered")),
    presentation: texto(formData, "presentation"),
    defaultBoosterIntervalDays: texto(formData, "defaultBoosterIntervalDays"),
    active: formData.get("active") === "on",
  };
}

export async function guardarProductoCatalogo(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const organizationId = z.string().uuid().safeParse(formData.get("organizationId"));
  const parsed = vaccineCatalogSchema.safeParse(catalogoDesdeFormulario(formData));
  if (!parsed.success || !organizationId.success) {
    return parsed.success
      ? { ok: false, message: mensajes.comun.errorInesperado }
      : { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("vaccines_catalog").insert({
    organization_id: organizationId.data,
    name: parsed.data.name,
    manufacturer: parsed.data.manufacturer ?? null,
    target_species: parsed.data.targetSpecies,
    diseases_covered: parsed.data.diseasesCovered ?? [],
    presentation: parsed.data.presentation ?? null,
    default_booster_interval_days: parsed.data.defaultBoosterIntervalDays ?? null,
    active: parsed.data.active,
    created_by: user?.id ?? null,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: mensajes.vacunacion.errores.productoDuplicado };
    }
    return errorAFormState(error);
  }

  revalidatePath("/app/configuracion/vacunas");
  return { ok: true, message: mensajes.vacunacion.catalogo.creado };
}

export async function actualizarProductoCatalogo(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = vaccineCatalogSchema.safeParse(catalogoDesdeFormulario(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  if (!parsed.data.catalogId) return { ok: false, message: mensajes.comun.errorInesperado };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vaccines_catalog")
    .update({
      name: parsed.data.name,
      manufacturer: parsed.data.manufacturer ?? null,
      target_species: parsed.data.targetSpecies,
      diseases_covered: parsed.data.diseasesCovered ?? [],
      presentation: parsed.data.presentation ?? null,
      default_booster_interval_days: parsed.data.defaultBoosterIntervalDays ?? null,
      active: parsed.data.active,
    })
    .eq("id", parsed.data.catalogId)
    .select("id");
  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: mensajes.vacunacion.errores.productoDuplicado };
    }
    return errorAFormState(error);
  }
  if (!data || data.length === 0) {
    return { ok: false, message: mensajes.vacunacion.catalogo.soloAdmin };
  }

  revalidatePath("/app/configuracion/vacunas");
  return { ok: true, message: mensajes.vacunacion.catalogo.actualizado };
}

// ---------------------------------------------------------------------------
// Comprobantes e impresión (bitácoras de acceso)
// ---------------------------------------------------------------------------

/** Registra la descarga (bitácora) y redirige a una URL firmada de corta vida. */
export async function descargarComprobanteHistorico(formData: FormData): Promise<void> {
  const parsed = z.string().uuid().safeParse(formData.get("recordId"));
  if (!isSupabaseConfigured() || !parsed.success) redirect("/app/vacunacion");

  const supabase = await createClient();
  const { data: registro } = await supabase
    .from("vaccination_records")
    .select("id, historical_document_path")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!registro?.historical_document_path) redirect("/app/vacunacion");

  // Bitácora de descarga: mejor esfuerzo, nunca bloquea la descarga.
  await supabase.rpc("log_vaccination_access", {
    p_record_id: registro.id,
    p_access_type: "download",
  });

  const { data: firmada } = await supabase.storage
    .from(BUCKET_VACUNACION)
    .createSignedUrl(registro.historical_document_path, env.CLINICAL_FILE_SIGNED_URL_SECONDS);
  if (!firmada?.signedUrl) {
    redirect(`/app/vacunacion/${registro.id}?comprobante=error`);
  }
  redirect(firmada.signedUrl);
}

/** Bitácora de impresión (mejor esfuerzo; nunca bloquea la impresión). */
export async function registrarImpresionVacunacion(
  recordId: string,
  accessType: "print" | "card_print" = "print",
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const parsed = z.string().uuid().safeParse(recordId);
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.rpc("log_vaccination_access", {
    p_record_id: parsed.data,
    p_access_type: accessType,
  });
}
