import type { MetadataRoute } from "next";

import { env } from "@/env";

/**
 * robots.txt: indexar solo el sitio público. Las rutas del panel (`/app`),
 * el portal del propietario (`/mi`) y los flujos de auth/invitación son
 * privados o efímeros y no deben aparecer en buscadores.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/app/",
          "/mi",
          "/iniciar-sesion",
          "/registro",
          "/recuperar-contrasena",
          "/actualizar-contrasena",
          "/confirmar",
          "/invitaciones/",
          "/portal/",
        ],
      },
    ],
    sitemap: new URL("/sitemap.xml", env.NEXT_PUBLIC_APP_URL).toString(),
  };
}
