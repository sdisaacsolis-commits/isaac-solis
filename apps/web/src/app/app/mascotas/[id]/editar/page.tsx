import { Card, CardContent, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { mensajes } from "@/lib/i18n/es-mx";
import { createClient } from "@/lib/supabase/server";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { PetEditForm } from "./pet-edit-form";

export const metadata: Metadata = { title: mensajes.pacientes.mascotas.editar };

export default async function PaginaEditarMascota({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  await requireTenancyContext();
  const supabase = await createClient();
  const { data: mascota } = await supabase.from("pets").select("*").eq("id", id).maybeSingle();
  if (!mascota) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>
            {mensajes.pacientes.mascotas.editar}: {mascota.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PetEditForm mascota={mascota} />
        </CardContent>
      </Card>
    </div>
  );
}
