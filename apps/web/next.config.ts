import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los paquetes internos se consumen como código fuente TS; Next los transpila.
  transpilePackages: ["@dogtoralia/ui"],
};

export default nextConfig;
