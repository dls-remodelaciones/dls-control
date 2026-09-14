/**
 * Scripts propios que la portada del sitio pide cargar (`<script src="...">`).
 *
 * Si uno de esos archivos no existe (se renombró, quedó fuera de un deploy), el
 * cotizador o el chatbot dejan de funcionar sin que nadie lo note: la página
 * carga igual. La revisión diaria (`lib/salud.ts`) los pide uno por uno.
 *
 * Devuelve los del mismo sitio y los de `hostsExtra`: la librería de EmailJS
 * viene de jsDelivr y sin ella no sale el correo de la cotización. Google
 * Analytics queda fuera: si falla, no se pierde ningún lead.
 */
export const HOSTS_CRITICOS = ["cdn.jsdelivr.net"];

export function scriptsLocales(html: string, sitio: string, hostsExtra: string[] = []): string[] {
  const base = new URL(sitio);
  const urls = new Set<string>();
  for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      const propio = u.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "");
      if (propio || hostsExtra.includes(u.hostname)) urls.add(u.toString());
    } catch {
      // src inválido: lo ignora, no es un script que el navegador pueda cargar.
    }
  }
  return [...urls];
}
