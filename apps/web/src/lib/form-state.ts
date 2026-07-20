/** Contrato de resultado para Server Actions consumidas con useActionState. */
export type FormState = {
  ok: boolean;
  /** Mensaje general para mostrar en un Alert (éxito o error). */
  message?: string;
  /** Advertencia no bloqueante (p. ej. invitación creada pero correo no enviado). */
  warning?: string;
  /** Errores por campo, con las llaves del esquema Zod correspondiente. */
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialFormState: FormState = { ok: false };
