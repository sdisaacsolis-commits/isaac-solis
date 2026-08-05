import { SERVICE_CATEGORIES } from "@dogtoralia/types";
import type { MetadataRoute } from "next";

import { env } from "@/env";
import {
  buscarClinicasPublicas,
  listarCiudadesPublicas,
  slugificarCiudad,
} from "@/lib/portal/public";

/**
 * Sitemap dinámico del sitio público: rutas fijas + directorios por ciudad y
 * categoría + fichas de clínica. Se alimenta de las mismas RPCs públicas que
 * las páginas (que degradan a listas vacías ante cualquier error), así que el
 * sitemap nunca rompe: crece solo conforme haya clínicas públicas.
 *
 * Los perfiles de veterinario no se enumeran aquí (no existe una RPC de
 * listado global); los descubre el crawler desde cada ficha de clínica.
 */
// Regenerar cada hora: las clínicas públicas nuevas aparecen sin redeploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_APP_URL;
  const url = (ruta: string) => new URL(ruta, base).toString();
  const ahora = new Date();

  const fijas: MetadataRoute.Sitemap = [
    { url: url("/"), lastModified: ahora, changeFrequency: "daily", priority: 1 },
    { url: url("/buscar"), lastModified: ahora, changeFrequency: "daily", priority: 0.9 },
    { url: url("/aviso-de-privacidad"), changeFrequency: "yearly", priority: 0.2 },
    { url: url("/terminos"), changeFrequency: "yearly", priority: 0.2 },
  ];

  const [ciudades, clinicas] = await Promise.all([
    listarCiudadesPublicas(),
    buscarClinicasPublicas({ limit: 100 }),
  ]);

  const directoriosCiudad: MetadataRoute.Sitemap = ciudades.map((ciudad) => ({
    url: url(`/veterinarios/${slugificarCiudad(ciudad.city)}`),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const directoriosServicio: MetadataRoute.Sitemap = ciudades.flatMap((ciudad) =>
    SERVICE_CATEGORIES.filter((categoria) => categoria !== "other").map((categoria) => ({
      url: url(`/servicios/${categoria}/${slugificarCiudad(ciudad.city)}`),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  );

  const fichasClinica: MetadataRoute.Sitemap = clinicas.map((clinica) => ({
    url: url(`/clinicas/${encodeURIComponent(clinica.slug)}`),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...fijas, ...directoriosCiudad, ...directoriosServicio, ...fichasClinica];
}
