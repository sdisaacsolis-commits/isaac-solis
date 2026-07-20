import type { NextConfig } from "next";

const esProduccion = process.env.NODE_ENV === "production";

// CSP inicial pragmática (documentada en docs/auth/authentication-flow.md):
// - connect-src permite el proyecto Supabase (REST + Auth + Realtime).
// - style-src 'unsafe-inline' es requisito de Next.js con CSS-in-JS/estilos inline.
// - script-src incluye 'unsafe-eval' SOLO en desarrollo (React Fast Refresh).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esProduccion ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' ${supabaseUrl} wss://*.supabase.co https://*.supabase.co`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Los paquetes internos se consumen como código fuente TS; Next los transpila.
  transpilePackages: ["@dogtoralia/ui"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
