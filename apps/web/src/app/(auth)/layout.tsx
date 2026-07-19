import Link from "next/link";

import { mensajes } from "@/lib/i18n/es-mx";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted px-4 py-10">
      <Link
        href="/"
        className="mb-8 text-2xl font-bold tracking-tight text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden="true">🐾 </span>
        {mensajes.marca.nombre}
      </Link>
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}
