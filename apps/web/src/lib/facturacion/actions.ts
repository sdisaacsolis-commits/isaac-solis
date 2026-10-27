"use server";

import { iniciarCheckoutSchema } from "@dogtoralia/validation";
import { redirect } from "next/navigation";

import { env } from "@/env";
import { logOperational } from "@/lib/log";
import { puedeAdministrarClinica } from "@/lib/roles";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { proveedorStripe } from "./stripe-provider";

/**
 * Inicia una sesión de Stripe Checkout para la clínica. DELGADA a propósito:
 * valida con Zod, verifica el rol administrador (la UI solo oculta; la
 * autorización real de leer/escribir la suscripción vive en la BD) y delega el
 * cobro al proveedor (18b). El resultado del pago regresa por webhook; aquí
 * nunca se toca `subscriptions` ni viaja la service_role.
 */
export async function iniciarCheckout(formData: FormData): Promise<void> {
  const parsed = iniciarCheckoutSchema.safeParse({
    clinicId: formData.get("clinicId"),
    planCode: formData.get("planCode"),
  });
  if (!parsed.success) redirect("/app/facturacion?estado=error");

  const context = await requireTenancyContext();
  const clinica = context.clinics.find((c) => c.id === parsed.data.clinicId) ?? null;
  const rolClinica =
    context.clinicMemberships.find((m) => m.clinic_id === parsed.data.clinicId)?.role ?? null;
  if (clinica === null || !puedeAdministrarClinica(context.membership.role, rolClinica)) {
    redirect("/app/facturacion?estado=sin-permiso");
  }
  if (!isSupabaseConfigured()) {
    redirect("/app/facturacion?estado=error");
  }

  // Veterinarios activos por encima del incluido: se cobran como partida extra.
  const supabase = await createClient();
  const { data: vets } = await supabase.rpc("clinic_active_veterinarian_count", {
    p_clinic_id: clinica.id,
  });
  const adicionales = Math.max(0, (typeof vets === "number" ? vets : 1) - 1);

  const base = env.NEXT_PUBLIC_APP_URL;
  let urlCheckout: string;
  try {
    const sesion = await proveedorStripe.crearSesionCheckout({
      planCode: parsed.data.planCode,
      clinicId: clinica.id,
      veterinariosAdicionales: adicionales,
      correoCliente: context.email,
      urlExito: `${base}/app/facturacion?estado=exito`,
      urlCancelacion: `${base}/app/facturacion?estado=cancelado`,
    });
    urlCheckout = sesion.url;
  } catch (error) {
    // Código estable del proveedor en el log operativo; al usuario, mensaje es-MX.
    logOperational("facturacion.checkout_error", {
      clinica: clinica.id,
      plan: parsed.data.planCode,
      mensaje: error instanceof Error ? error.message : String(error),
    });
    redirect("/app/facturacion?estado=error");
  }
  redirect(urlCheckout);
}
