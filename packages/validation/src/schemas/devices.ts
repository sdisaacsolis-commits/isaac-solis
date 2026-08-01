import { DEVICE_PLATFORMS } from "@dogtoralia/types";
import { z } from "zod";

/**
 * Esquemas del registro de tokens push (Fase 9). El token lo emite el proveedor
 * (FCM) desde la app; aquí se valida forma y plataforma antes de tocar la BD.
 * La autoridad final es PostgreSQL (RPC register_device_token SECURITY DEFINER).
 */

export const registerDeviceTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .min(10, "El token de push no es válido.")
    .max(4096, "El token de push es demasiado largo."),
  platform: z.enum(DEVICE_PLATFORMS, {
    errorMap: () => ({ message: "Plataforma inválida." }),
  }),
});

export const unregisterDeviceTokenSchema = z.object({
  token: z.string().trim().min(10, "El token de push no es válido."),
});

export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>;
export type UnregisterDeviceTokenInput = z.infer<typeof unregisterDeviceTokenSchema>;
