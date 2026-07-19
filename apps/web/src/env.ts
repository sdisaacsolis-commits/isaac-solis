import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Validación de variables de entorno (CLAUDE.md §1-2).
 *
 * - Las variables `server` solo existen en el servidor: si un componente de cliente
 *   intenta leerlas, `@t3-oss/env-nextjs` lanza un error en tiempo de ejecución.
 *   Esto protege contra el uso accidental de secretos en el navegador.
 * - Las variables `client` deben llevar el prefijo `NEXT_PUBLIC_` (verificado por tipo).
 * - En la Fase 1 casi todas son opcionales porque aún no se consumen; al integrarlas
 *   (Fase 2+) se vuelven obligatorias aquí y el build falla si faltan.
 */
export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    SUPABASE_DB_URL: z.string().url().optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    EMAIL_REPLY_TO: z.string().email().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  emptyStringAsUndefined: true,
});
