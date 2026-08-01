"use client";

import { FormField, Input, Textarea } from "@dogtoralia/ui";
import Link from "next/link";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { guardarPerfilPublicoVeterinario } from "@/lib/portal/actions";

const t = mensajes.configuracion.perfilPublico;

export interface PerfilPublicoDefaults {
  slug: string;
  headline: string;
  bio: string;
  isPublic: boolean;
}

/** Perfil público del veterinario (RLS: solo el propio; opt-in con is_public). */
export function PerfilPublicoForm({ defaults }: { defaults: PerfilPublicoDefaults }) {
  const [state, action] = useActionState(guardarPerfilPublicoVeterinario, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormAlerts state={state} />
      <FormField
        htmlFor="perfil-slug"
        label={t.slug}
        required
        hint={t.pistaSlug}
        error={primerError(state, "slug")}
      >
        <Input id="perfil-slug" name="slug" required defaultValue={defaults.slug} maxLength={80} />
      </FormField>
      <FormField
        htmlFor="perfil-headline"
        label={t.headline}
        hint={t.pistaHeadline}
        error={primerError(state, "headline")}
      >
        <Input
          id="perfil-headline"
          name="headline"
          defaultValue={defaults.headline}
          maxLength={200}
        />
      </FormField>
      <FormField htmlFor="perfil-bio" label={t.bio} error={primerError(state, "bio")}>
        <Textarea
          id="perfil-bio"
          name="bio"
          rows={4}
          defaultValue={defaults.bio}
          maxLength={2000}
        />
      </FormField>
      <div className="flex items-center gap-2">
        <input
          id="perfil-isPublic"
          name="isPublic"
          type="checkbox"
          defaultChecked={defaults.isPublic}
          className="h-4 w-4 rounded border-border accent-brand-600"
        />
        <label htmlFor="perfil-isPublic" className="text-sm text-ink">
          {t.esPublico}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText={mensajes.comun.guardando}>{mensajes.comun.guardar}</SubmitButton>
        {defaults.isPublic && defaults.slug ? (
          <Link
            className="text-sm font-medium text-brand-700 hover:underline"
            href={`/veterinarios/${defaults.slug}`}
          >
            {t.verPerfil}
          </Link>
        ) : null}
      </div>
    </form>
  );
}
