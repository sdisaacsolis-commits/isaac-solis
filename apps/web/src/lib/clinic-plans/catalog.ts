// Commercial reference for the public site and clinic dashboard, not an entitlement or checkout.
export const CLINIC_TRIAL = {
  code: "trial_30d",
  days: 30,
  priceCents: 0,
} as const;

type PaidClinicPlan = Readonly<{
  code: "consultorio_monthly" | "clinica_monthly" | "red_monthly";
  priceCents: number;
  locations: number;
  veterinarians: number;
}>;

export const CLINIC_PAID_PLANS = [
  { code: "consultorio_monthly", priceCents: 34_900, locations: 1, veterinarians: 2 },
  { code: "clinica_monthly", priceCents: 64_900, locations: 1, veterinarians: 6 },
  { code: "red_monthly", priceCents: 109_900, locations: 3, veterinarians: 12 },
] as const satisfies readonly PaidClinicPlan[];

export const CLINIC_PLAN_PATH = "/planes";
export const CLINIC_TRIAL_QUERY = "prueba";
export const CLINIC_TRIAL_REGISTER_PATH = `/registro?plan=${CLINIC_TRIAL_QUERY}`;

const mxn = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

export function formatClinicPlanPrice(cents: number): string {
  return `$${mxn.format(cents / 100)}`;
}
