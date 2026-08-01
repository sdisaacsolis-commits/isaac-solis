import Link from "next/link";

import { mensajes } from "@/lib/i18n/es-mx";
import type { DocumentoLegal } from "@/lib/legal";

const t = mensajes.legal;

/**
 * Renderiza un {@link DocumentoLegal} con semántica accesible: `<article>` con
 * `<h1>` único y una `<section>` por apartado encabezada por `<h2>`. El texto
 * proviene del módulo `@/lib/legal` (fuente única es-MX); aquí no hay cadenas
 * legales sueltas. El landmark `<main>` lo aporta el layout del portal.
 */
export function DocumentoLegalView({ documento }: Readonly<{ documento: DocumentoLegal }>) {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-12">
      <nav aria-label={t.nav} className="mb-6 text-sm">
        <Link
          href="/"
          className="text-ink-muted hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t.volverInicio}
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-ink">{documento.titulo}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t.actualizado(documento.actualizado)}</p>
      </header>

      {documento.introduccion ? (
        <div className="mb-8 space-y-3 text-ink">
          {documento.introduccion.map((parrafo) => (
            <p key={parrafo}>{parrafo}</p>
          ))}
        </div>
      ) : null}

      <div className="space-y-8">
        {documento.secciones.map((seccion) => (
          <section key={seccion.titulo}>
            <h2 className="mb-3 text-xl font-semibold text-ink">{seccion.titulo}</h2>
            <div className="space-y-3 text-ink-muted">
              {seccion.parrafos.map((parrafo) => (
                <p key={parrafo}>{parrafo}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
