import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";
import { z } from "zod";

import { mensajes } from "@/lib/i18n/es-mx";
import { nombrePropietario } from "@/lib/pets/format";
import { createClient } from "@/lib/supabase/server";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { PetForm } from "./pet-form";

export const metadata: Metadata = { title: mensajes.pacientes.mascotas.nueva };

export default async function PaginaNuevaMascota({
  searchParams,
}: {
  searchParams: Promise<{ propietario?: string }>;
}) {
  const [context, params] = await Promise.all([requireTenancyContext(), searchParams]);
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{mensajes.panel.sinClinica}</p>;
  }

  const supabase = await createClient();
  const { data: relaciones } = await supabase
    .from("owner_clinic_relationships")
    .select("owner_id, pet_owners!inner(id, first_name, last_name, display_name)")
    .eq("clinic_id", context.activeClinic.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const propietarios = (relaciones ?? []).map((r) => ({
    id: r.owner_id,
    nombre: nombrePropietario(
      r.pet_owners as { display_name: string | null; first_name: string; last_name: string },
    ),
  }));

  const preseleccionado = z.string().uuid().safeParse(params.propietario);

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{mensajes.pacientes.mascotas.nueva}</CardTitle>
          <CardDescription>{context.activeClinic.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <PetForm
            clinicId={context.activeClinic.id}
            propietarios={propietarios}
            propietarioPreseleccionado={preseleccionado.success ? preseleccionado.data : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
