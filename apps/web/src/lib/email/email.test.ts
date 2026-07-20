import { describe, expect, it } from "vitest";

import { redactSensitive } from "@/lib/log";

import { createDevEmailProvider } from "./dev-provider";
import { buildInvitationUrl } from "./invitation-link";
import { htmlInvitacion, textoInvitacion } from "./template-invitacion";

const TOKEN = "ab12".repeat(16); // 64 hex

describe("buildInvitationUrl", () => {
  it("construye el enlace con la base normalizada", () => {
    expect(buildInvitationUrl("http://localhost:3000/", TOKEN)).toBe(
      `http://localhost:3000/invitaciones/${TOKEN}`,
    );
  });

  it("rechaza tokens con formato inválido", () => {
    expect(() => buildInvitationUrl("http://localhost:3000", "corto")).toThrow();
    expect(() => buildInvitationUrl("http://localhost:3000", `${TOKEN.slice(0, 63)}Z`)).toThrow();
  });
});

describe("redactSensitive", () => {
  it("reduce el token de un enlace a sus últimos 4 caracteres", () => {
    const redacted = redactSensitive(`http://localhost:3000/invitaciones/${TOKEN}`);
    expect(redacted).not.toContain(TOKEN);
    expect(redacted).toContain(`…${TOKEN.slice(-4)}`);
  });
});

describe("adaptador de correo de desarrollo", () => {
  it("no envía, reporta sent:false y jamás registra el token completo", async () => {
    const lines: string[] = [];
    const provider = createDevEmailProvider((line) => lines.push(line));
    const result = await provider.sendInvitation({
      to: "nueva@ejemplo.mx",
      clinicName: "Clínica Luna",
      roleLabel: "Recepcionista",
      acceptUrl: `http://localhost:3000/invitaciones/${TOKEN}`,
      expiresAtText: "26 de julio de 2026, 10:00",
    });

    expect(result.sent).toBe(false);
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(TOKEN);
    expect(lines[0]).toContain(TOKEN.slice(-4));
  });
});

describe("plantilla de invitación", () => {
  const input = {
    to: "nueva@ejemplo.mx",
    clinicName: 'Clínica "Luna" <Centro>',
    roleLabel: "Recepcionista",
    acceptUrl: `http://localhost:3000/invitaciones/${TOKEN}`,
    expiresAtText: "26 de julio de 2026, 10:00",
    inviteeName: "Sofía",
  };

  it("incluye clínica, rol, vencimiento y enlace en texto plano", () => {
    const texto = textoInvitacion(input);
    expect(texto).toContain("Recepcionista");
    expect(texto).toContain(input.acceptUrl);
    expect(texto).toContain("26 de julio de 2026");
    expect(texto).toContain("Sofía");
  });

  it("escapa HTML en los datos interpolados", () => {
    const html = htmlInvitacion(input);
    expect(html).not.toContain("<Centro>");
    expect(html).toContain("&lt;Centro&gt;");
    expect(html).toContain("Aceptar invitación");
  });
});
