import Link from "next/link";

import { requireSuperadmin } from "@/lib/admin/guard";
import { mensajes } from "@/lib/i18n/es-mx";

// Sección privada de superadmin: siempre dinámica (depende de la sesión).
export const dynamic = "force-dynamic";

const t = mensajes.admin;

const subenlaces = [
  { href: "/app/admin", etiqueta: t.nav.panorama },
  { href: "/app/admin/clinicas", etiqueta: t.nav.clinicas },
  { href: "/app/admin/actividad", etiqueta: t.nav.actividad },
];

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Guard de sección: si no es superadmin, 404 (no revela la existencia de la ruta).
  await requireSuperadmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t.descripcion}</p>
      </div>
      <nav
        aria-label={t.titulo}
        className="flex flex-wrap items-center gap-1 border-b border-border pb-2"
      >
        {subenlaces.map((enlace) => (
          <Link
            key={enlace.href}
            href={enlace.href}
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {enlace.etiqueta}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
