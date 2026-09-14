import type { NextConfig } from "next";

/**
 * Encabezados de seguridad del panel. Es la herramienta con los datos de todos
 * los clientes: no se puede meter dentro de otra página (X-Frame-Options), el
 * navegador no adivina tipos de archivo, y al abrir un enlace externo no se
 * filtra la dirección del panel.
 */
const seguridad = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: seguridad }];
  },
};

export default nextConfig;
