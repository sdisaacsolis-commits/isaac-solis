import { Button, Input, Select } from "@dogtoralia/ui";

import { mensajes } from "@/lib/i18n/es-mx";
import type { CiudadPublica } from "@/lib/portal/public";

const t = mensajes.portalPublico.buscador;

/**
 * Buscador del marketplace (GET → /buscar). Pestañas solo visuales: la
 * modalidad "En línea" queda deshabilitada como próximamente (fase posterior).
 */
export function BuscadorPublico({
  ciudades,
  defaultQ = "",
  defaultCiudad = "",
  defaultCategoria,
}: {
  ciudades: CiudadPublica[];
  defaultQ?: string;
  defaultCiudad?: string;
  defaultCategoria?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="presentation">
        <span className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white">
          {t.presencial}
        </span>
        <span
          aria-disabled="true"
          title={t.enLineaProximamente}
          className="cursor-not-allowed rounded-full border border-border px-4 py-1.5 text-sm text-ink-muted"
        >
          {t.enLinea} · {mensajes.comun.proximamente.toLowerCase()}
        </span>
      </div>
      <form
        action="/buscar"
        method="get"
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-end"
      >
        {defaultCategoria ? (
          <input type="hidden" name="categoria" value={defaultCategoria} />
        ) : null}
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="buscador-q" className="text-sm font-medium text-ink">
            {t.etiquetaQue}
          </label>
          <Input
            id="buscador-q"
            name="q"
            placeholder={t.placeholderQue}
            defaultValue={defaultQ}
            maxLength={120}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-56">
          <label htmlFor="buscador-ciudad" className="text-sm font-medium text-ink">
            {t.etiquetaCiudad}
          </label>
          <Select id="buscador-ciudad" name="ciudad" defaultValue={defaultCiudad}>
            <option value="">{t.todasLasCiudades}</option>
            {ciudades.map((ciudad) => (
              <option key={ciudad.city} value={ciudad.city}>
                {ciudad.city}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" size="lg">
          {t.buscar}
        </Button>
      </form>
    </div>
  );
}
