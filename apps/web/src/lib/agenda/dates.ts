import { DEFAULT_TIMEZONE } from "@dogtoralia/types";

/**
 * Utilidades de fecha/zona de la agenda. Regla del producto (CLAUDE.md §13):
 * todo se ALMACENA en UTC (timestamptz) y se PRESENTA en la zona IANA de la
 * clínica. Sin dependencias: la conversión usa Intl con doble pasada, que
 * resuelve correctamente los bordes de horario de verano.
 */

function partesEnZona(instanteMs: number, timeZone: string) {
  const formato = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const partes = Object.fromEntries(
    formato.formatToParts(new Date(instanteMs)).map((p) => [p.type, p.value]),
  );
  return Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour === "24" ? "0" : partes.hour),
    Number(partes.minute),
    Number(partes.second),
  );
}

/**
 * Convierte una fecha-hora local de la clínica ("YYYY-MM-DDTHH:MM", como la
 * produce un input datetime-local) al instante UTC correspondiente.
 */
export function localAUtc(local: string, timeZone: string): Date {
  const [fecha, hora] = local.split("T");
  if (!fecha || !hora) throw new Error("Fecha local inválida");
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  const objetivo = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);

  let estimado = objetivo - (partesEnZona(objetivo, timeZone) - objetivo);
  estimado -= partesEnZona(estimado, timeZone) - objetivo;
  return new Date(estimado);
}

/** Instante UTC → cadena para un input datetime-local en la zona dada. */
export function utcALocalInput(iso: string | Date, timeZone: string): string {
  const ms = typeof iso === "string" ? Date.parse(iso) : iso.getTime();
  const wall = new Date(partesEnZona(ms, timeZone));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${wall.getUTCFullYear()}-${p(wall.getUTCMonth() + 1)}-${p(wall.getUTCDate())}T${p(
    wall.getUTCHours(),
  )}:${p(wall.getUTCMinutes())}`;
}

/** Fecha "YYYY-MM-DD" del día actual en la zona indicada. */
export function hoyEnZona(timeZone: string = DEFAULT_TIMEZONE, ahora: Date = new Date()): string {
  return utcALocalInput(ahora, timeZone).slice(0, 10);
}

/** Suma días a una fecha "YYYY-MM-DD" (aritmética de calendario, sin zona). */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function formatearFechaHora(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Instante ISO → fecha en español ("28 de julio de 2026"), sin la hora. */
export function formatearFecha(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatearHora(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatearFechaLarga(fecha: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${fecha}T12:00:00Z`));
}

/** Centavos MXN → "$1,234.50". Dinero SIEMPRE en enteros de centavos. */
export function formatearPrecioMXN(centavos: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    centavos / 100,
  );
}
