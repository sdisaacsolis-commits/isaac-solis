import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.resenas;

interface Props {
  /** Promedio 1–5 (o null cuando no hay opiniones). */
  value: number | null;
  /** Total de opiniones; con 0 se muestra el estado vacío. */
  count?: number | null;
  size?: "sm" | "md";
  /** Muestra "(N opiniones)" junto a las estrellas. */
  showCount?: boolean;
  className?: string;
}

/**
 * Estrellas de calificación accesibles y reutilizables (tarjetas, perfiles,
 * formularios). Relleno fraccional con dos capas superpuestas recortadas por
 * ancho (sin ids de gradiente, seguro con varias instancias por página). El
 * valor va en un aria-label; los glifos son decorativos.
 */
export function RatingStars({ value, count, size = "md", showCount = false, className }: Props) {
  if (value === null || (typeof count === "number" && count === 0)) {
    return <span className="text-sm text-ink-muted">{t.sinOpiniones}</span>;
  }

  const acotado = Math.max(0, Math.min(5, value));
  const porcentaje = (acotado / 5) * 100;
  const tamano = size === "sm" ? "text-sm" : "text-base";

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <span
        role="img"
        aria-label={t.estrellasAria(acotado)}
        className={`relative inline-block whitespace-nowrap leading-none ${tamano}`}
      >
        <span aria-hidden="true" className="text-border">
          ★★★★★
        </span>
        <span
          aria-hidden="true"
          className="absolute inset-0 overflow-hidden text-accent-600"
          style={{ width: `${porcentaje}%` }}
        >
          ★★★★★
        </span>
      </span>
      {showCount && typeof count === "number" ? (
        <span className="text-sm text-ink-muted">
          {acotado.toFixed(1)} · {t.opiniones(count)}
        </span>
      ) : null}
    </span>
  );
}
