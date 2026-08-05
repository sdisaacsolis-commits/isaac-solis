import { ImageResponse } from "next/og";

import { mensajes } from "@/lib/i18n/es-mx";

/**
 * Imagen Open Graph por defecto de todo el sitio (la usan WhatsApp, Facebook,
 * X, etc. al compartir cualquier URL). Generada con el tema de marca: teal
 * profundo + acento ámbar, sin depender de archivos binarios en el repo.
 */
export const alt = mensajes.meta.tituloPorDefecto;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "linear-gradient(135deg, #0c3a3d 0%, #14555a 55%, #1c6f74 100%)",
        color: "#f4fbfa",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ fontSize: 96 }}>🐾</div>
        <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: "-0.03em" }}>
          {mensajes.marca.nombre}
        </div>
      </div>
      <div
        style={{
          marginTop: 28,
          fontSize: 38,
          lineHeight: 1.3,
          maxWidth: 900,
          color: "#c9e6e3",
        }}
      >
        {mensajes.marca.eslogan}
      </div>
      <div
        style={{
          marginTop: 44,
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontSize: 28,
          color: "#f2c078",
        }}
      >
        <div style={{ width: 56, height: 6, background: "#f2c078", borderRadius: 3 }} />
        dogtoralia.mx
      </div>
    </div>,
    size,
  );
}
