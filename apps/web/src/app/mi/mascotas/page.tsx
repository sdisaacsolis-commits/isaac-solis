import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { mensajes } from "@/lib/i18n/es-mx";
import { etiquetasEspecie } from "@/lib/pets/format";
import { obtenerMisMascotas } from "@/lib/portal/mi";

const t = mensajes.mi.mascotas;

export const metadata: Metadata = { title: t.titulo };

export default async function PaginaMisMascotas({
  searchParams,
}: {
  searchParams: Promise<{ vinculado?: string }>;
}) {
  const [mascotas, params] = await Promise.all([obtenerMisMascotas(), searchParams]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
        <p className="text-sm text-ink-muted">{mensajes.mi.descripcion}</p>
      </div>

      {params.vinculado === "1" ? (
        <Alert variant="success">{mensajes.mi.invitacion.exito}</Alert>
      ) : null}

      {mascotas.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface-muted px-4 py-6 text-ink-muted">
          {t.vacio}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {mascotas.map((mascota) => (
            <Card key={mascota.pet_id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{mascota.name}</CardTitle>
                  <Badge>{etiquetasEspecie[mascota.species]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {mascota.breed ? (
                  <p className="text-ink-muted">
                    {t.raza}: <span className="text-ink">{mascota.breed}</span>
                  </p>
                ) : null}
                {mascota.birth_date ? (
                  <p className="text-ink-muted">
                    {t.nacimiento}:{" "}
                    <span className="text-ink">
                      {new Intl.DateTimeFormat("es-MX", {
                        dateStyle: "long",
                        timeZone: "UTC",
                      }).format(new Date(`${mascota.birth_date}T12:00:00Z`))}
                    </span>
                  </p>
                ) : null}
                <div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/mi/mascotas/${mascota.pet_id}`}>{t.verHistorial}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
