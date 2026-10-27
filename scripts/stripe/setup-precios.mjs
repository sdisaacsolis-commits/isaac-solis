#!/usr/bin/env node
/**
 * Alta idempotente del catálogo de Dogtoralia en Stripe (Fase 13).
 *
 * Crea (si no existen) los productos y precios con las `lookup_key` que usa el
 * panel para iniciar el checkout:
 *   profesional_mensual   $599.00 MXN / mes   (membresía por clínica)
 *   profesional_anual     $5,990.00 MXN / año
 *   vet_adicional_mensual $399.00 MXN / mes   (por veterinario adicional)
 *   vet_adicional_anual   $3,990.00 MXN / año
 *
 * Los precios son + IVA: el impuesto lo gestiona Stripe Tax o la configuración
 * fiscal de la cuenta; aquí los montos van sin IVA (tax_behavior=exclusive).
 *
 * Uso:  STRIPE_SECRET_KEY=sk_... node scripts/stripe/setup-precios.mjs
 * Reejecutable: si una lookup_key ya existe con el monto correcto, se omite;
 * si existe con otro monto, se crea un precio nuevo y la llave se transfiere
 * (transfer_lookup_key), dejando el anterior sin llave (histórico).
 */

const API = "https://api.stripe.com/v1";
const llave = process.env.STRIPE_SECRET_KEY;

if (!llave) {
  console.error("Falta STRIPE_SECRET_KEY en el entorno. Aborto sin cambios.");
  process.exit(1);
}

const PRODUCTOS = [
  {
    clave: "dogtoralia_membresia",
    nombre: "Dogtoralia — Membresía Profesional",
    descripcion:
      "Membresía por clínica: agenda, expediente clínico, recetas, vacunación, recordatorios y perfil público. Incluye 1 veterinario.",
  },
  {
    clave: "dogtoralia_vet_adicional",
    nombre: "Dogtoralia — Veterinario adicional",
    descripcion: "Veterinario activo adicional al incluido en la membresía de la clínica.",
  },
];

const PRECIOS = [
  {
    lookupKey: "profesional_mensual",
    producto: "dogtoralia_membresia",
    centavos: 59900,
    intervalo: "month",
  },
  {
    lookupKey: "profesional_anual",
    producto: "dogtoralia_membresia",
    centavos: 599000,
    intervalo: "year",
  },
  {
    lookupKey: "vet_adicional_mensual",
    producto: "dogtoralia_vet_adicional",
    centavos: 39900,
    intervalo: "month",
  },
  {
    lookupKey: "vet_adicional_anual",
    producto: "dogtoralia_vet_adicional",
    centavos: 399000,
    intervalo: "year",
  },
];

async function stripe(ruta, { method = "GET", body } = {}) {
  const respuesta = await fetch(`${API}${ruta}`, {
    method,
    headers: {
      authorization: `Bearer ${llave}`,
      ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok) {
    const mensaje = cuerpo?.error?.message ?? `HTTP ${respuesta.status}`;
    throw new Error(`Stripe ${method} ${ruta}: ${mensaje}`);
  }
  return cuerpo;
}

/** Busca un producto por metadata.clave; lo crea si no existe. */
async function asegurarProducto({ clave, nombre, descripcion }) {
  const encontrados = await stripe(
    `/products/search?query=${encodeURIComponent(`metadata['clave']:'${clave}' AND active:'true'`)}`,
  );
  if (encontrados.data.length > 0) {
    console.log(`producto ${clave}: ya existe (${encontrados.data[0].id})`);
    return encontrados.data[0].id;
  }
  const body = new URLSearchParams({
    name: nombre,
    description: descripcion,
    "metadata[clave]": clave,
  });
  const creado = await stripe("/products", { method: "POST", body });
  console.log(`producto ${clave}: creado (${creado.id})`);
  return creado.id;
}

/** Crea el precio si su lookup_key no existe con el monto/intervalo correctos. */
async function asegurarPrecio(productos, { lookupKey, producto, centavos, intervalo }) {
  const query = new URLSearchParams({ active: "true", limit: "1" });
  query.append("lookup_keys[]", lookupKey);
  const existentes = await stripe(`/prices?${query}`);
  const actual = existentes.data[0];
  if (actual && actual.unit_amount === centavos && actual.recurring?.interval === intervalo) {
    console.log(`precio ${lookupKey}: ya existe (${actual.id})`);
    return;
  }
  const body = new URLSearchParams({
    product: productos[producto],
    currency: "mxn",
    unit_amount: String(centavos),
    tax_behavior: "exclusive",
    lookup_key: lookupKey,
    transfer_lookup_key: "true",
    "recurring[interval]": intervalo,
  });
  const creado = await stripe("/prices", { method: "POST", body });
  console.log(
    actual
      ? `precio ${lookupKey}: monto distinto; creado ${creado.id} y llave transferida`
      : `precio ${lookupKey}: creado (${creado.id})`,
  );
}

const productos = {};
for (const producto of PRODUCTOS) {
  productos[producto.clave] = await asegurarProducto(producto);
}
for (const precio of PRECIOS) {
  await asegurarPrecio(productos, precio);
}
console.log("Catálogo de Stripe listo.");
