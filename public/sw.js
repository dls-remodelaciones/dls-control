/*
 * Service worker de DLS Control: recibe los avisos y los muestra.
 *
 * Existe para una sola cosa: que Daniel se entere en el momento de que alguien
 * le escribió o dejó sus datos, sin tener el panel abierto. Un WhatsApp tiene
 * 24 horas para responderse con texto libre; si nadie se entera, esas horas
 * corren igual.
 *
 * Deliberadamente no cachea nada ni intenta funcionar sin conexión: un panel de
 * leads con datos viejos en pantalla es peor que uno que dice "sin conexión".
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { titulo: "DLS Control", cuerpo: event.data ? event.data.text() : "" };
  }

  const titulo = datos.titulo || "DLS Control";
  const cuerpo = datos.cuerpo || "";
  const data = { url: datos.url || "/" };
  // Si showNotification falla, iOS muestra un aviso genérico que dice solo
  // "Notificación", sin decir quién escribió. Por eso hay un segundo intento con
  // lo mínimo: título y texto, sin opciones que un navegador pueda rechazar.
  event.waitUntil(
    self.registration
      .showNotification(titulo, {
        body: cuerpo,
        icon: "/icon",
        // Mismo tag para el mismo lead: si escribe tres veces seguidas, se
        // reemplaza el aviso en vez de apilar tres.
        tag: datos.tag || undefined,
        data,
      })
      .catch(() => self.registration.showNotification(titulo, { body: cuerpo, data })),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      // Si el panel ya está abierto, se trae al frente en vez de abrir otro.
      for (const v of ventanas) {
        if ("focus" in v) {
          v.navigate(destino);
          return v.focus();
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
