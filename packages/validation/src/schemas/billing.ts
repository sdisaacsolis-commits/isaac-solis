import { z } from "zod";

/**
 * Esquemas de facturación (Fase 13 — cobro de membresía).
 *
 * El checkout se inicia desde el panel con un plan comercial del catálogo
 * activo; todo lo demás (precios, periodos, estados) lo decide el backend de
 * cobro (Stripe + webhook con service_role), nunca el cliente.
 */

/** Códigos de los planes comerciales que pueden contratarse en línea. */
export const PLAN_CODES = ["profesional", "profesional_anual"] as const;

export const planCodeSchema = z.enum(PLAN_CODES, {
  errorMap: () => ({ message: "Selecciona un plan válido." }),
});

export type PlanCode = z.infer<typeof planCodeSchema>;

/** Entrada de la Server Action que inicia una sesión de Stripe Checkout. */
export const iniciarCheckoutSchema = z.object({
  clinicId: z.string().uuid("Identificador inválido."),
  planCode: planCodeSchema,
});

export type IniciarCheckoutInput = z.infer<typeof iniciarCheckoutSchema>;
