import crypto from "crypto";

/**
 * Firma de Meta en los POST del webhook de WhatsApp (cabecera X-Hub-Signature-256).
 *
 * Es lo único que impide que cualquiera invente mensajes "de clientes" contra
 * la URL del webhook: el verify_token solo protege el alta. Vive aparte de la
 * ruta para poder probarla (tests/firma-meta.test.ts).
 *
 * Sin secreto configurado deja pasar y avisa en el log: se prefirió recibir
 * leads sin firmar a perderlos. La revisión diaria verifica que WA_APP_SECRET
 * exista, así que ese caso no puede quedar olvidado.
 */
export function firmaValida(crudo: string, firma: string | null, secretoCrudo: string | undefined): boolean {
  // `.trim()`: un secreto pegado a mano en un panel llega con espacios o un
  // salto de línea más veces de las que uno quisiera, y el fallo resultante es
  // idéntico al de un secreto equivocado.
  const secreto = (secretoCrudo ?? "").trim();
  if (!secreto) {
    console.warn("WhatsApp: sin WA_APP_SECRET, no se verifica la firma de Meta");
    return true;
  }
  if (!firma?.startsWith("sha256=")) {
    console.error("WhatsApp: llegó un POST sin cabecera de firma de Meta");
    return false;
  }
  const esperada = "sha256=" + crypto.createHmac("sha256", secreto).update(crudo).digest("hex");
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  const calza = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!calza) {
    // Pistas para distinguir "secreto equivocado" de "cuerpo alterado", sin
    // escribir el secreto en ningún log: los primeros caracteres de dos HMAC
    // no permiten reconstruir la clave.
    console.error(
      "WhatsApp: firma no calza.",
      `largo_secreto=${secreto.length}`,
      `largo_cuerpo=${crudo.length}`,
      `recibida=${firma.slice(0, 15)}…`,
      `esperada=${esperada.slice(0, 15)}…`,
    );
  }
  return calza;
}
