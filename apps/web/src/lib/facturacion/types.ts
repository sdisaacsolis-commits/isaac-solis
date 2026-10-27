import type { PlanCode } from "@dogtoralia/validation";

/**
 * Interfaz del proveedor de pagos (ARCHITECTURE.md §6.1): el dominio solo
 * conoce este contrato; el proveedor concreto (Stripe) vive detrás. Nada de
 * datos de tarjetas en nuestra base: el checkout sucede en el proveedor y el
 * resultado regresa por webhook (Edge Function con service_role).
 */

export interface ParametrosCheckout {
  /** Plan comercial elegido (catálogo activo validado con Zod). */
  planCode: PlanCode;
  /** Clínica que contrata; viaja como metadata para que el webhook la vincule. */
  clinicId: string;
  /** Veterinarios activos por encima del incluido; se cobran como partida extra. */
  veterinariosAdicionales: number;
  /** Correo de quien contrata, para precargar el checkout (opcional). */
  correoCliente: string | null;
  /** URL absoluta de regreso tras pagar. */
  urlExito: string;
  /** URL absoluta de regreso al cancelar. */
  urlCancelacion: string;
}

export interface SesionDeCobro {
  /** URL del checkout alojado por el proveedor, a la que se redirige. */
  url: string;
}

export interface ProveedorDePagos {
  crearSesionCheckout(params: ParametrosCheckout): Promise<SesionDeCobro>;
}
