import { Button } from "@dogtoralia/ui";
import Link from "next/link";

import { cerrarSesion } from "@/lib/auth/actions";
import { mensajes } from "@/lib/i18n/es-mx";
import { requireUser } from "@/lib/tenancy/queries";

// Rutas privadas: siempre dinámicas (dependen de la sesión en cookies).
export const dynamic = "force-dynamic";

const nav = mensajes.panel.nav;

const enlaces = [
  { href: "/app/inicio", etiqueta: nav.inicio },
  { href: "/app/agenda", etiqueta: nav.agenda },
  { href: "/app/propietarios", etiqueta: nav.propietarios },
  { href: "/app/mascotas", etiqueta: nav.mascotas },
  { href: "/app/organizacion", etiqueta: nav.organizacion },
  { href: "/app/clinicas", etiqueta: nav.clinicas },
  { href: "/app/personal", etiqueta: nav.personal },
  { href: "/app/configuracion", etiqueta: nav.configuracion },
];

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Protección de servidor (además del middleware): sin sesión → redirect.
  const { profile, email } = await requireUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link
            href="/app/inicio"
            className="text-lg font-bold tracking-tight text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden="true">🐾 </span>
            {mensajes.marca.nombre}
          </Link>
          <nav aria-label="Navegación principal" className="flex flex-wrap items-center gap-1">
            {enlaces.map((enlace) => (
              <Link
                key={enlace.href}
                href={enlace.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {enlace.etiqueta}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-muted sm:inline">
              {profile?.display_name ?? email}
            </span>
            <form action={cerrarSesion}>
              <Button type="submit" variant="outline" size="sm">
                {mensajes.auth.cerrarSesion}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
