/**
 * Scripts propios que la portada del sitio pide cargar (`<script src="...">`).
 *
 * Si uno de esos archivos no existe (se renombró, quedó fuera de un deploy), el
 * cotizador o el chatbot dejan de funcionar sin que nadie lo note: la página
 * carga igual. La revisión diaria (`lib/salud.ts`) los pide uno por uno.
 *
 * Solo devuelve los del mismo sitio: los externos (Google, EmailJS) no dependen
 * de nosotros y a veces bloquean pedidos desde servidores.
 */
export function scriptsLocales(html: string, sitio: string): string[] {
  const base = new URL(sitio);
  const urls = new Set<string>();
  for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      if (u.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "")) urls.add(u.toString());
    } catch {
      // src inválido: lo ignora, no es un script que el navegador pueda cargar.
    }
  }
  return [...urls];
}
