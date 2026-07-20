"use server";

import { OWNER_PET_RELATIONSHIP_TYPES } from "@dogtoralia/types";
import {
  createOwnerSchema,
  createPetSchema,
  petAlertSchema,
  updateOwnerSchema,
  updatePetSchema,
} from "@dogtoralia/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import { nombrePropietario } from "./format";
import { subirFotoMascota } from "./photos";
import { buscarMascotasParecidas, buscarPropietariosParecidos } from "./queries";

/** Estado de formulario con posibles coincidencias (detección de duplicados). */
export type PacienteFormState = FormState & {
  coincidencias?: { id: string; titulo: string; detalle: string }[];
};

function sinSupabase(): PacienteFormState {
  return { ok: false, message: mensajes.comun.supabaseNoConfigurado };
}

function texto(formData: FormData, campo: string): string | undefined {
  const v = formData.get(campo);
  if (typeof v !== "string") return undefined;
  const limpio = v.trim();
  return limpio === "" ? undefined : limpio;
}

const VERSION_AVISO_PRIVACIDAD = "v1.0-2026";

// ---------------------------------------------------------------------------
// Propietarios
// ---------------------------------------------------------------------------
export async function crearPropietario(
  _prev: PacienteFormState,
  formData: FormData,
): Promise<PacienteFormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const clinicId = z.string().uuid().safeParse(formData.get("clinicId"));
  if (!clinicId.success) return { ok: false, message: mensajes.comun.errorInesperado };

  const parsed = createOwnerSchema.safeParse({
    firstName: texto(formData, "firstName"),
    lastName: texto(formData, "lastName"),
    email: texto(formData, "email"),
    phone: texto(formData, "phone"),
    secondaryPhone: texto(formData, "secondaryPhone"),
    preferredContactMethod: texto(formData, "preferredContactMethod") ?? "phone",
    addressLine1: texto(formData, "addressLine1"),
    addressLine2: texto(formData, "addressLine2"),
    neighborhood: texto(formData, "neighborhood"),
    city: texto(formData, "city"),
    state: texto(formData, "state"),
    postalCode: texto(formData, "postalCode"),
    administrativeNotes: texto(formData, "administrativeNotes"),
    internalCustomerNumber: texto(formData, "internalCustomerNumber"),
    confirmDuplicates: formData.get("confirmDuplicates") === "true",
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // Detección de duplicados dentro del alcance RLS (jamás registros ajenos).
  if (!parsed.data.confirmDuplicates) {
    const parecidos = await buscarPropietariosParecidos({
      email: parsed.data.email,
      phone: parsed.data.phone,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
    });
    if (parecidos.length > 0) {
      return {
        ok: false,
        warning: mensajes.pacientes.duplicados.aviso,
        coincidencias: parecidos.map((p) => ({
          id: p.id,
          titulo: nombrePropietario(p),
          detalle: [p.email, p.phone].filter(Boolean).join(" · ") || "—",
        })),
      };
    }
  }

  const supabase = await createClient();
  const { data: ownerId, error } = await supabase.rpc("register_owner_with_clinic", {
    p_clinic_id: clinicId.data,
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_secondary_phone: parsed.data.secondaryPhone,
    p_preferred_contact_method: parsed.data.preferredContactMethod,
    p_address_line_1: parsed.data.addressLine1,
    p_address_line_2: parsed.data.addressLine2,
    p_neighborhood: parsed.data.neighborhood,
    p_city: parsed.data.city,
    p_state: parsed.data.state,
    p_postal_code: parsed.data.postalCode,
    p_administrative_notes: parsed.data.administrativeNotes,
    p_internal_customer_number: parsed.data.internalCustomerNumber,
  });

  if (error || !ownerId) {
    if (error?.code === "42501") {
      return { ok: false, message: mensajes.pacientes.propietarios.sinPermiso };
    }
    if (error?.code === "23505") {
      return { ok: false, message: mensajes.pacientes.propietarios.numeroClienteOcupado };
    }
    return { ok: false, message: mensajes.comun.errorInesperado };
  }

  // Consentimiento del aviso de privacidad (versionado), si se recabó.
  if (formData.get("privacyConsent") === "on") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: clinica } = await supabase
      .from("clinics")
      .select("organization_id")
      .eq("id", clinicId.data)
      .maybeSingle();
    await supabase.from("owner_consents").insert({
      owner_id: ownerId,
      organization_id: clinica?.organization_id ?? null,
      clinic_id: clinicId.data,
      type: "privacy_notice",
      document_version: VERSION_AVISO_PRIVACIDAD,
      medium: "in_person",
      recorded_by: user?.id ?? null,
    });
  }

  revalidatePath("/app/propietarios");
  redirect(`/app/propietarios/${ownerId}`);
}

export async function actualizarPropietario(
  _prev: PacienteFormState,
  formData: FormData,
): Promise<PacienteFormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const ownerId = z.string().uuid().safeParse(formData.get("ownerId"));
  if (!ownerId.success) return { ok: false, message: mensajes.comun.errorInesperado };

  const parsed = updateOwnerSchema.safeParse({
    firstName: texto(formData, "firstName"),
    lastName: texto(formData, "lastName"),
    email: texto(formData, "email"),
    phone: texto(formData, "phone"),
    secondaryPhone: texto(formData, "secondaryPhone"),
    preferredContactMethod: texto(formData, "preferredContactMethod") ?? "phone",
    addressLine1: texto(formData, "addressLine1"),
    addressLine2: texto(formData, "addressLine2"),
    neighborhood: texto(formData, "neighborhood"),
    city: texto(formData, "city"),
    state: texto(formData, "state"),
    postalCode: texto(formData, "postalCode"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pet_owners")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      secondary_phone: parsed.data.secondaryPhone ?? null,
      preferred_contact_method: parsed.data.preferredContactMethod,
      address_line_1: parsed.data.addressLine1 ?? null,
      address_line_2: parsed.data.addressLine2 ?? null,
      neighborhood: parsed.data.neighborhood ?? null,
      city: parsed.data.city ?? null,
      state: parsed.data.state ?? null,
      postal_code: parsed.data.postalCode ?? null,
    })
    .eq("id", ownerId.data)
    .select("id");

  if (error) return { ok: false, message: mensajes.comun.errorInesperado };
  if (!data || data.length === 0) {
    return { ok: false, message: mensajes.pacientes.propietarios.sinPermiso };
  }

  // Notas administrativas de la clínica (viven en la relación, no en el perfil).
  const notas = texto(formData, "administrativeNotes");
  const clinicId = z.string().uuid().safeParse(formData.get("clinicId"));
  if (clinicId.success) {
    await supabase
      .from("owner_clinic_relationships")
      .update({ administrative_notes: notas ?? null })
      .eq("owner_id", ownerId.data)
      .eq("clinic_id", clinicId.data)
      .eq("status", "active");
  }

  revalidatePath(`/app/propietarios/${ownerId.data}`);
  return { ok: true, message: mensajes.pacientes.propietarios.actualizado };
}

// ---------------------------------------------------------------------------
// Mascotas
// ---------------------------------------------------------------------------
export async function crearMascota(
  _prev: PacienteFormState,
  formData: FormData,
): Promise<PacienteFormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const clinicId = z.string().uuid().safeParse(formData.get("clinicId"));
  if (!clinicId.success) return { ok: false, message: mensajes.comun.errorInesperado };

  const parsed = createPetSchema.safeParse({
    ownerId: formData.get("ownerId"),
    name: texto(formData, "name"),
    species: formData.get("species"),
    breed: texto(formData, "breed"),
    sex: texto(formData, "sex") ?? "unknown",
    birthDate: texto(formData, "birthDate"),
    approximateBirthDate: formData.get("approximateBirthDate") === "on",
    color: texto(formData, "color"),
    identifyingMarks: texto(formData, "identifyingMarks"),
    microchipNumber: texto(formData, "microchipNumber"),
    sterilized: texto(formData, "sterilized") ?? "desconocido",
    internalPatientNumber: texto(formData, "internalPatientNumber"),
    relationshipType: texto(formData, "relationshipType") ?? "owner",
    confirmDuplicates: formData.get("confirmDuplicates") === "true",
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!parsed.data.confirmDuplicates) {
    const parecidas = await buscarMascotasParecidas({
      microchip: parsed.data.microchipNumber,
      name: parsed.data.name,
      species: parsed.data.species,
      ownerId: parsed.data.ownerId,
    });
    if (parecidas.length > 0) {
      return {
        ok: false,
        warning: mensajes.pacientes.duplicados.aviso,
        coincidencias: parecidas.map((p) => ({
          id: p.id,
          titulo: p.name,
          detalle: [p.breed, p.microchip_number].filter(Boolean).join(" · ") || "—",
        })),
      };
    }
  }

  const supabase = await createClient();
  const { data: petId, error } = await supabase.rpc("register_pet_with_relationships", {
    p_clinic_id: clinicId.data,
    p_owner_id: parsed.data.ownerId,
    p_name: parsed.data.name,
    p_species: parsed.data.species,
    p_breed: parsed.data.breed,
    p_sex: parsed.data.sex,
    p_birth_date: parsed.data.birthDate,
    p_approximate_birth_date: parsed.data.approximateBirthDate,
    p_color: parsed.data.color,
    p_identifying_marks: parsed.data.identifyingMarks,
    p_microchip_number: parsed.data.microchipNumber,
    p_sterilized:
      parsed.data.sterilized === "desconocido" ? undefined : parsed.data.sterilized === "si",
    p_relationship_type: parsed.data.relationshipType,
    p_internal_patient_number: parsed.data.internalPatientNumber,
    p_source: "manual",
  });

  if (error || !petId) {
    if (error?.message.includes("MICROCHIP_DUPLICADO")) {
      return {
        ok: false,
        fieldErrors: { microchipNumber: [mensajes.pacientes.mascotas.microchipDuplicado] },
      };
    }
    if (error?.code === "42501") {
      return { ok: false, message: mensajes.pacientes.mascotas.sinPermiso };
    }
    if (error?.code === "23505") {
      return { ok: false, message: mensajes.pacientes.mascotas.numeroPacienteOcupado };
    }
    return { ok: false, message: mensajes.comun.errorInesperado };
  }

  // Fotografía opcional (procesada y privada).
  const foto = formData.get("photo");
  let advertencia: string | undefined;
  if (foto instanceof File && foto.size > 0) {
    const resultado = await subirFotoMascota(petId, foto, null);
    if (!resultado.ok) advertencia = resultado.error;
  }

  revalidatePath("/app/mascotas");
  redirect(`/app/mascotas/${petId}${advertencia ? "?foto=error" : ""}`);
}

export async function actualizarMascota(
  _prev: PacienteFormState,
  formData: FormData,
): Promise<PacienteFormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const petId = z.string().uuid().safeParse(formData.get("petId"));
  if (!petId.success) return { ok: false, message: mensajes.comun.errorInesperado };

  const parsed = updatePetSchema.safeParse({
    name: texto(formData, "name"),
    species: formData.get("species") ?? undefined,
    breed: texto(formData, "breed"),
    sex: texto(formData, "sex"),
    birthDate: texto(formData, "birthDate"),
    approximateBirthDate: formData.get("approximateBirthDate") === "on",
    color: texto(formData, "color"),
    identifyingMarks: texto(formData, "identifyingMarks"),
    microchipNumber: texto(formData, "microchipNumber"),
    sterilized: texto(formData, "sterilized") ?? "desconocido",
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pets")
    .update({
      name: parsed.data.name,
      species: parsed.data.species,
      breed: parsed.data.breed ?? null,
      sex: parsed.data.sex,
      birth_date: parsed.data.birthDate ?? null,
      approximate_birth_date: parsed.data.approximateBirthDate,
      color: parsed.data.color ?? null,
      identifying_marks: parsed.data.identifyingMarks ?? null,
      microchip_number: parsed.data.microchipNumber ?? null,
      sterilized: parsed.data.sterilized === "desconocido" ? null : parsed.data.sterilized === "si",
    })
    .eq("id", petId.data)
    .select("id, photo_path");

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        fieldErrors: { microchipNumber: [mensajes.pacientes.mascotas.microchipDuplicado] },
      };
    }
    return { ok: false, message: mensajes.comun.errorInesperado };
  }
  if (!data || data.length === 0) {
    return { ok: false, message: mensajes.pacientes.mascotas.sinPermiso };
  }

  const foto = formData.get("photo");
  if (foto instanceof File && foto.size > 0) {
    const resultado = await subirFotoMascota(petId.data, foto, data[0]?.photo_path ?? null);
    if (!resultado.ok) {
      return {
        ok: true,
        message: mensajes.pacientes.mascotas.actualizada,
        warning: resultado.error,
      };
    }
  }

  revalidatePath(`/app/mascotas/${petId.data}`);
  return { ok: true, message: mensajes.pacientes.mascotas.actualizada };
}

// ---------------------------------------------------------------------------
// Relaciones y alertas
// ---------------------------------------------------------------------------
export async function agregarPropietarioMascota(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return { ok: false, message: mensajes.comun.supabaseNoConfigurado };
  const parsed = z
    .object({
      petId: z.string().uuid(),
      ownerId: z.string().uuid("Selecciona un propietario válido."),
      relationshipType: z
        .enum(OWNER_PET_RELATIONSHIP_TYPES, {
          errorMap: () => ({ message: "Selecciona un tipo de relación válido." }),
        })
        .default("family_member"),
    })
    .safeParse({
      petId: formData.get("petId"),
      ownerId: formData.get("ownerId"),
      relationshipType: texto(formData, "relationshipType") ?? "family_member",
    });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_pet_owner", {
    p_pet_id: parsed.data.petId,
    p_owner_id: parsed.data.ownerId,
    p_relationship_type: parsed.data.relationshipType,
  });
  if (error) {
    if (error.message.includes("RELACION_DUPLICADA")) {
      return { ok: false, message: mensajes.pacientes.mascotas.relacionDuplicada };
    }
    return { ok: false, message: mensajes.comun.errorInesperado };
  }
  revalidatePath(`/app/mascotas/${parsed.data.petId}`);
  return { ok: true, message: mensajes.pacientes.mascotas.propietarioAgregado };
}

export async function transferirPropietarioPrincipal(formData: FormData): Promise<void> {
  const parsed = z
    .object({ petId: z.string().uuid(), ownerId: z.string().uuid() })
    .safeParse({ petId: formData.get("petId"), ownerId: formData.get("ownerId") });
  if (!isSupabaseConfigured() || !parsed.success) redirect("/app/mascotas");

  const supabase = await createClient();
  await supabase.rpc("set_primary_pet_owner", {
    p_pet_id: parsed.data.petId,
    p_owner_id: parsed.data.ownerId,
  });
  revalidatePath(`/app/mascotas/${parsed.data.petId}`);
  redirect(`/app/mascotas/${parsed.data.petId}`);
}

export async function crearAlerta(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return { ok: false, message: mensajes.comun.supabaseNoConfigurado };

  const clinicId = z.string().uuid().safeParse(formData.get("clinicId"));
  const parsed = petAlertSchema.safeParse({
    petId: formData.get("petId"),
    type: formData.get("type"),
    severity: texto(formData, "severity") ?? "caution",
    title: texto(formData, "title"),
    description: texto(formData, "description"),
  });
  if (!clinicId.success) return { ok: false, message: mensajes.comun.errorInesperado };
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const [{ data: clinica }, { data: userData }] = await Promise.all([
    supabase.from("clinics").select("organization_id").eq("id", clinicId.data).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (!clinica) return { ok: false, message: mensajes.comun.errorInesperado };

  const { error } = await supabase.from("pet_alerts").insert({
    organization_id: clinica.organization_id,
    clinic_id: clinicId.data,
    pet_id: parsed.data.petId,
    type: parsed.data.type,
    severity: parsed.data.severity,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    created_by: userData.user?.id ?? null,
  });
  if (error) {
    return {
      ok: false,
      message:
        error.code === "42501"
          ? mensajes.pacientes.alertas.sinPermiso
          : mensajes.comun.errorInesperado,
    };
  }
  revalidatePath(`/app/mascotas/${parsed.data.petId}`);
  return { ok: true, message: mensajes.pacientes.alertas.creada };
}

export async function resolverAlerta(formData: FormData): Promise<void> {
  const parsed = z
    .object({ alertId: z.string().uuid(), petId: z.string().uuid() })
    .safeParse({ alertId: formData.get("alertId"), petId: formData.get("petId") });
  if (!isSupabaseConfigured() || !parsed.success) redirect("/app/mascotas");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase
    .from("pet_alerts")
    .update({ active: false, resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null })
    .eq("id", parsed.data.alertId);
  revalidatePath(`/app/mascotas/${parsed.data.petId}`);
  redirect(`/app/mascotas/${parsed.data.petId}`);
}

export async function vincularMascotaExistente(formData: FormData): Promise<void> {
  const parsed = z
    .object({ petId: z.string().uuid(), clinicId: z.string().uuid() })
    .safeParse({ petId: formData.get("petId"), clinicId: formData.get("clinicId") });
  if (!isSupabaseConfigured() || !parsed.success) redirect("/app/mascotas");

  const supabase = await createClient();
  const { error } = await supabase.rpc("link_pet_to_clinic", {
    p_pet_id: parsed.data.petId,
    p_clinic_id: parsed.data.clinicId,
    p_source: "manual",
  });
  if (error && !error.message.includes("RELACION_DUPLICADA")) {
    redirect("/app/mascotas?error=vinculo");
  }
  redirect(`/app/mascotas/${parsed.data.petId}`);
}
