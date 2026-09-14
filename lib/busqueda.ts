/**
 * Búsqueda de leads en el panel: por nombre, teléfono, correo, comuna o tipo.
 *
 * Sin tildes ni mayúsculas ("nunoa" encuentra "Ñuñoa"), y el teléfono se busca
 * por dígitos: "9 1234 5678", "+56912345678" y "12345678" encuentran al mismo.
 */

const plano = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ñ/g, "n");

export function coincide(f: Record<string, unknown>, consulta: string): boolean {
  const q = plano(consulta).trim();
  if (!q) return true;

  const digitos = q.replace(/\D/g, "");
  if (digitos.length >= 4 && digitos.length === q.replace(/[\s+().-]/g, "").length) {
    const tel = String(f.telefono ?? "").replace(/\D/g, "");
    if (tel.includes(digitos.replace(/^56/, ""))) return true;
  }

  const texto = [f.nombre, f.email, f.comuna, f.tipo_proyecto, f.nota_interna, f.telefono].map(plano).join(" ");
  // Todas las palabras tienen que aparecer, en cualquier orden: "ana nunoa".
  return q.split(/\s+/).every((p) => texto.includes(p));
}
