import "./globals.css";

import type { Metadata } from "next";

// Importar `env` aquí fuerza la validación de variables de entorno al arrancar/compilar.
import { env } from "@/env";
import { mensajes } from "@/lib/i18n/es-mx";

export const metadata: Metadata = {
  title: {
    default: mensajes.meta.tituloPorDefecto,
    template: mensajes.meta.plantillaTitulo,
  },
  description: mensajes.meta.descripcion,
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
