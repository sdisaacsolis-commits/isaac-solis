import "server-only";

import { randomUUID } from "node:crypto";

import { env } from "@/env";
import { createClient } from "@/lib/supabase/server";

import { esFotoValida, PET_PHOTOS_BUCKET } from "./photos-shared";

/**
 * Fotografías de mascotas: bucket privado, rutas internas con UUIDs
 * aleatorios (jamás nombres del usuario), URLs firmadas SOLO en servidor.
 * Procesamiento con sharp: corrige orientación EXIF, redimensiona a 1024px,
 * convierte a WebP y descarta metadatos (sharp no copia EXIF por defecto).
 */

export function construirRutaFoto(petId: string): string {
  return `pets/${petId}/${randomUUID()}.webp`;
}

export async function procesarFoto(original: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  return sharp(original, { limitInputPixels: 40_000_000 })
    .rotate() // aplica la orientación EXIF y la descarta
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

/**
 * Sube la foto procesada y actualiza pets.photo_path. Devuelve la ruta nueva.
 * El reemplazo elimina la foto anterior en el mismo flujo (mejor esfuerzo:
 * si la eliminación falla, el archivo huérfano queda inaccesible por RLS y se
 * limpiará por mantenimiento de backend).
 */
export async function subirFotoMascota(
  petId: string,
  archivo: File,
  rutaAnterior: string | null,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const valida = esFotoValida({ size: archivo.size, type: archivo.type });
  if (!valida.ok) return { ok: false, error: valida.error };

  const supabase = await createClient();
  const procesada = await procesarFoto(Buffer.from(await archivo.arrayBuffer()));
  const ruta = construirRutaFoto(petId);

  const { error: uploadError } = await supabase.storage
    .from(PET_PHOTOS_BUCKET)
    .upload(ruta, procesada, { contentType: "image/webp", upsert: false });
  if (uploadError) {
    return { ok: false, error: "No fue posible guardar la fotografía." };
  }

  const { data, error: updateError } = await supabase
    .from("pets")
    .update({ photo_path: ruta })
    .eq("id", petId)
    .select("id");
  if (updateError || !data || data.length === 0) {
    await supabase.storage.from(PET_PHOTOS_BUCKET).remove([ruta]);
    return { ok: false, error: "No fue posible asociar la fotografía a la mascota." };
  }

  if (rutaAnterior && rutaAnterior !== ruta) {
    await supabase.storage.from(PET_PHOTOS_BUCKET).remove([rutaAnterior]);
  }
  return { ok: true, path: ruta };
}

/** URL firmada de corta duración (solo servidor; nunca se persiste). */
export async function firmarFotoMascota(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(PET_PHOTOS_BUCKET)
    .createSignedUrl(path, env.PET_PHOTO_SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}
