import type { NextConfig } from "next";

/**
 * Encabezados de seguridad del panel. Es la herramienta con los datos de todos
 * los clientes: no se puede meter dentro de otra página (X-Frame-Options), el
 * navegador no adivina tipos de archivo, y al abrir un enlace externo no se
 * filtra la dirección del panel.
 */
/**
 * Política de contenido: el panel solo puede cargar código propio y hablar con
 * Supabase. Si algún día se cuela un script ajeno (una dependencia comprometida,
 * un texto de cliente mal escapado), el navegador no lo deja mandar los datos a
 * otro lado. 'unsafe-inline' en scripts lo exige Next.js para hidratar la página.
 * Si se agrega un servicio externo al panel, hay que sumarlo acá o no carga.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "media-src 'self' blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const seguridad = [
  { key: "Content-Security-Policy", value: csp },
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
