import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dogtoralia/ui";

import { mensajes } from "@/lib/i18n/es-mx";

const { marca, inicio } = mensajes;

export default function PaginaInicio() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <p className="text-xl font-bold tracking-tight text-brand-700">
            <span aria-hidden="true">🐾 </span>
            {marca.nombre}
          </p>
          <Button disabled title={inicio.tituloBotonProximamente}>
            {inicio.botonProximamente}
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-6 pb-16 pt-20 text-center sm:pt-28">
          <p className="mx-auto mb-4 w-fit rounded-full bg-brand-100 px-4 py-1 text-sm font-medium text-brand-800">
            {inicio.etiquetaHero}
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            {marca.eslogan}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-muted">{inicio.descripcionHero}</p>
          <div className="mt-10 flex justify-center">
            <Button size="lg" disabled title={inicio.tituloBotonProximamente}>
              {inicio.botonProximamente}
            </Button>
          </div>
        </section>

        <section
          aria-label={inicio.etiquetaSeccionModulos}
          className="mx-auto grid w-full max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-3"
        >
          {inicio.modulos.map((modulo) => (
            <Card key={modulo.titulo} className="text-left">
              <CardHeader>
                <CardTitle>{modulo.titulo}</CardTitle>
                <CardDescription>{modulo.descripcion}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-medium uppercase tracking-wide text-accent-600">
                  {inicio.enDesarrollo}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-ink-muted sm:flex-row">
          <p>
            © {new Date().getFullYear()} {marca.nombre}. {inicio.derechos}
          </p>
          <p>{inicio.lemaPie}</p>
        </div>
      </footer>
    </div>
  );
}
