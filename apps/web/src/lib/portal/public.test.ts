import { publicSearchSchema } from "@dogtoralia/validation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buscarClinicasPublicas,
  buscarClinicasPublicasConEstado,
  type ClinicaPublicaResumen,
  obtenerHuecosPublicos,
} from "./public";

const { configurado, crearCliente, rpc } = vi.hoisted(() => ({
  configurado: vi.fn(),
  crearCliente: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: configurado }));
vi.mock("@/lib/supabase/server", () => ({ createClient: crearCliente }));

const clinica: ClinicaPublicaResumen = {
  slug: "clinica-ejemplo",
  name: "Clínica de prueba",
  city: "Monterrey",
  state: "Nuevo León",
  neighborhood: null,
  description: null,
  accepts_online_booking: false,
  services_count: 1,
  price_from_cents: null,
  rating: { average: null, count: 0 },
};

const noDisponible = { ok: false, codigo: "PUBLIC_SEARCH_UNAVAILABLE" };

beforeEach(() => {
  vi.resetAllMocks();
  configurado.mockReturnValue(true);
  crearCliente.mockResolvedValue({ rpc });
  rpc.mockResolvedValue({ data: [], error: null });
});

describe("buscarClinicasPublicasConEstado", () => {
  it("distingue una búsqueda válida sin coincidencias", async () => {
    await expect(buscarClinicasPublicasConEstado({})).resolves.toEqual({
      ok: true,
      clinicas: [],
    });
  });

  it("devuelve las clínicas y envía la paginación a la RPC pública", async () => {
    rpc.mockResolvedValue({ data: [clinica], error: null });

    await expect(
      buscarClinicasPublicasConEstado({ q: "Luna", ciudad: "Monterrey", limit: 13, offset: 12 }),
    ).resolves.toEqual({ ok: true, clinicas: [clinica] });
    expect(rpc).toHaveBeenCalledWith("search_public_clinics", {
      p_q: "Luna",
      p_city: "Monterrey",
      p_category: undefined,
      p_limit: 13,
      p_offset: 12,
    });
  });

  it("envía filtros vacíos del formulario como ausentes, no como una ciudad vacía", async () => {
    const filtros = publicSearchSchema.parse({ q: " ", ciudad: "", categoria: "" });

    await buscarClinicasPublicasConEstado(filtros);

    expect(rpc).toHaveBeenCalledWith("search_public_clinics", {
      p_q: undefined,
      p_city: undefined,
      p_category: undefined,
      p_limit: 20,
      p_offset: 0,
    });
  });

  it("no presenta una configuración ausente como cero coincidencias", async () => {
    configurado.mockReturnValue(false);

    await expect(buscarClinicasPublicasConEstado({})).resolves.toEqual(noDisponible);
    expect(crearCliente).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("devuelve un código estable sin revelar detalles del error de RPC", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "detalle interno de prueba" } });

    await expect(buscarClinicasPublicasConEstado({})).resolves.toEqual(noDisponible);
  });

  it("captura fallos de transporte", async () => {
    rpc.mockRejectedValue(new Error("fallo de red de prueba"));

    await expect(buscarClinicasPublicasConEstado({})).resolves.toEqual(noDisponible);
  });

  it("captura fallos al inicializar el cliente", async () => {
    crearCliente.mockRejectedValue(new Error("fallo de inicialización de prueba"));

    await expect(buscarClinicasPublicasConEstado({})).resolves.toEqual(noDisponible);
  });

  it.each([null, {}, "respuesta inválida"])(
    "no interpreta una respuesta inválida (%j) como vacía",
    async (data) => {
      rpc.mockResolvedValue({ data, error: null });

      await expect(buscarClinicasPublicasConEstado({})).resolves.toEqual(noDisponible);
    },
  );
});

describe("buscarClinicasPublicas (compatibilidad de directorios)", () => {
  it("mantiene el contrato de lista en búsquedas exitosas", async () => {
    rpc.mockResolvedValue({ data: [clinica], error: null });

    await expect(buscarClinicasPublicas({})).resolves.toEqual([clinica]);
  });

  it("mantiene el fallback de lista vacía ante errores", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "fallo de prueba" } });

    await expect(buscarClinicasPublicas({})).resolves.toEqual([]);
  });
});

const consulta = {
  clinicSlug: "ejemplo",
  serviceId: "servicio",
  veterinarianMemberId: "vet",
  from: "2026-11-25",
  to: "2026-11-25",
};
describe("disponibilidad pública", () => {
  it("diferencia sin horarios de una falla", async () => {
    await expect(obtenerHuecosPublicos(consulta)).resolves.toEqual([]);
    rpc.mockResolvedValue({ data: null, error: { message: "internal" } });
    await expect(obtenerHuecosPublicos(consulta)).resolves.toBeNull();
  });
  it("no propaga fallas de transporte", async () => {
    rpc.mockRejectedValue(new Error("network"));
    await expect(obtenerHuecosPublicos(consulta)).resolves.toBeNull();
  });
  it("sin configuración no consulta backend", async () => {
    configurado.mockReturnValue(false);
    await expect(obtenerHuecosPublicos(consulta)).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});
