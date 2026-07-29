import { Button } from "@dogtoralia/ui";
import Link from "next/link";

import { mensajes } from "@/lib/i18n/es-mx";

const { marca, inicio, portalPublico } = mensajes;
const pie = portalPublico.footer;

/**
 * Cascarón del sitio público (marketplace): cabecera con acceso al panel y
 * pie de dos audiencias (dueños de mascotas / profesionales) + legal.
 */
export default function PortalPublicoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 py-4">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden="true">🐾 </span>
            {marca.nombre}
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/iniciar-sesion">{inicio.entrar}</Link>
            </Button>
            <Button asChild>
              <Link href="/registro">{inicio.crearCuenta}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 sm:grid-cols-3">
          <nav aria-label={pie.duenos} className="flex flex-col gap-2 text-sm">
            <p className="font-semibold text-ink">{pie.duenos}</p>
            <Link className="text-ink-muted hover:text-ink hover:underline" href="/buscar">
              {pie.buscarClinicas}
            </Link>
            <Link className="text-ink-muted hover:text-ink hover:underline" href="/mi">
              {pie.miPortal}
            </Link>
          </nav>
          <nav aria-label={pie.profesionales} className="flex flex-col gap-2 text-sm">
            <p className="font-semibold text-ink">{pie.profesionales}</p>
            <Link className="text-ink-muted hover:text-ink hover:underline" href="/registro">
              {pie.crearCuentaPro}
            </Link>
            <Link className="text-ink-muted hover:text-ink hover:underline" href="/iniciar-sesion">
              {pie.accesoPanel}
            </Link>
          </nav>
          <nav aria-label={pie.legal} className="flex flex-col gap-2 text-sm">
            <p className="font-semibold text-ink">{pie.legal}</p>
            <Link
              className="text-ink-muted hover:text-ink hover:underline"
              href="/aviso-de-privacidad"
            >
              {pie.avisoPrivacidad}
            </Link>
            <Link className="text-ink-muted hover:text-ink hover:underline" href="/terminos">
              {pie.terminos}
            </Link>
          </nav>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-ink-muted sm:flex-row">
            <p>
              © {new Date().getFullYear()} {marca.nombre}. {inicio.derechos}
            </p>
            <p>{inicio.lemaPie}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
