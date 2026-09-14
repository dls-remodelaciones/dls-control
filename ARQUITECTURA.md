# Arquitectura de DLS Control y del sitio

Mapa de todo el sistema al 14 de septiembre de 2026. Para entender qué hace cada pieza y
dónde tocar, antes de abrir el código. Los detalles de cada decisión están en los
comentarios de cada archivo.

## Las dos aplicaciones

| | Sitio público | Panel DLS Control |
|---|---|---|
| Dirección | https://www.dlsremodelaciones.cl | https://dls-control.vercel.app |
| Repositorio | `dls-remodelaciones/dls-sitio` (carpeta `COTIZADOR DLS CLAUDE/deploy`) | `dls-remodelaciones/dls-control` (esta carpeta) |
| Tecnología | HTML + JS sin compilar | Next.js 16 (App Router) |
| Despliegue | Vercel, en cada push a `main` | Vercel, en cada push a `main` |
| Autor de los commits | `dls.lehmann@gmail.com` (si no, Vercel bloquea) | igual |

## Cómo entra un lead

```
Visitante ──> cotizador (iframe srcdoc) ─┐
          ──> chatbot ───────────────────┼──> POST /api/leads/webhook ──> lib/registrar-lead.ts ──> Supabase
          ──> formulario ────────────────┘        (origen, token, topes)     (dedupe, puntaje)        │
Cliente ───> WhatsApp (+56 9 5638 1974) ──> Meta ──> POST /api/whatsapp/webhook ─────────────────────┤
Cliente ───> Instagram DM (@dls.remodelaciones) ──> Meta ──> POST /api/instagram/webhook ────────────┤
Cliente ───> Messenger (pág. DLS Expertos en Remodelaciones) ──> Meta ──> POST /api/facebook/webhook ┤
Daniel ────> "+ Anotar lead" ──────────────────────> POST /api/leads/crear ─────────────────────────┘
                                                                                                    │
                            aviso al celular (Web Push, lib/avisos.ts) <────────────────────────────┘
```

- **Una sola lógica de alta**: `lib/registrar-lead.ts`. Dedupe por teléfono, correo o
  `sesion_id` (siempre entre comillas en el filtro), varios proyectos por persona, un campo
  vacío nunca borra uno lleno, comunas al nombre oficial (`lib/comunas.ts`).
- **Puntaje en dos lugares**: en el navegador (`deploy/dls-lead.js` + `deploy/config/negocio.json`)
  y en el panel (`lib/negocio.ts`). La revisión diaria compara las reglas (`lib/paridad.ts`).
- **Topes contra inundaciones** en la entrada: `lib/limite.ts`.
- **WhatsApp**: firma de Meta en `lib/firma-meta.ts`; texto legible de cualquier tipo de
  mensaje en `lib/wa-mensajes.ts`; fotos/audios/documentos guardados en el bucket privado
  `adjuntos` (`lib/adjuntos.ts`); envíos y plantillas en `lib/whatsapp.ts`.
- **Instagram y Messenger comparten la lógica** en `lib/procesar-messenger.ts` (misma
  Messenger Platform, mismo payload): cada archivo de canal solo aporta su nombre, su prefijo
  de `sesion_id` y su etiqueta visible. Antes eran dos copias de las mismas 80 líneas.
- **Instagram** (`lib/procesar-instagram.ts`, misma firma de Meta que WhatsApp): un DM no
  trae teléfono, solo un IGSID — el lead entra con `sesion_id: "ig:<IGSID>"` y queda SIN
  CONTACTO hasta que la persona deje un teléfono o correo en el DM. Solo entrada por ahora
  (sin responder desde el panel todavía); app de Meta separada ("DLS Control-IG",
  id 2053433005356915), cuenta `dls.remodelaciones` conectada como evaluadora.
- **Facebook Messenger** (`lib/procesar-facebook.ts`, mismo patrón que Instagram, payload
  casi idéntico salvo `object: "page"` y el sender es un PSID en vez de un IGSID): el lead
  entra con `sesion_id: "fb:<PSID>"`, también SIN CONTACTO. Página "DLS Expertos en
  Remodelaciones" (id 1282934911570871). Solo entrada por ahora, misma limitación que
  Instagram. **Probado de punta a punta el 2026-09-14** con un DM real (webhook verificado,
  página conectada, suscrita al campo `messages`, lead entrando).
  **Pendiente crítico, a diferencia de Instagram: el permiso `pages_messaging` no tiene
  Advanced Access.** Mientras no se complete la revisión de la aplicación (App Review) ante
  Meta, el webhook solo recibe mensajes de personas con un rol en la app DLS Control
  (Administrador, Desarrollador o Evaluador) — un cliente cualquiera que le escriba a la
  página NO generará un lead. Instagram no tiene esta restricción porque usa el flujo de
  "Instagram Login" con permisos estándar. Para destrabarlo: Meta for Developers → esta app →
  Casos de uso → Messenger from Meta → Configuración de Messenger API → paso 3 "Completar la
  revisión de la aplicación" → "Solicitar permiso" de `pages_messaging` (exige grabar un video
  de demostración del caso de uso; puede tardar días en aprobarse).

  **Trampa del App Review (descubierta el 2026-09-14):** además del video y los formularios,
  Meta exige al menos **una llamada real a la Graph API con `pages_messaging`** antes de dejar
  enviar la solicitud ("0 de las 1 llamadas a la API requeridas"). Como este webhook solo
  *recibe*, nunca *llama*, el contador queda en cero para siempre por sí solo. Se destraba con
  una llamada de lectura: `GET /1282934911570871/conversations` con un **identificador de
  acceso de la página** (no sirve el de usuario: devuelve `(#190) This method must be called
  with a Page Access Token`). Ese identificador se genera en Configuración de Messenger API →
  paso 2 "Generar identificadores de acceso" → botón "Generar" de la fila de la página; se
  muestra una sola vez. El desplegable "Usuario o página" del Explorador de la API Graph **no
  sirve** para obtenerlo: pide el permiso obsoleto `manage_pages` y falla con "Invalid Scopes".
  Meta tarda hasta 24 h en reflejar la llamada, y el test vence a los 30 días.

## Panel (pantallas)

| Archivo | Qué es |
|---|---|
| `app/page.tsx` | Pestañas Hoy / Bandeja / Pipeline, tarjetas de lead, buscador, Excel, `/?lead=id` |
| `app/ficha.tsx` | Ficha editable, "¿por qué este puntaje?", recordatorio con fecha |
| `app/historial.tsx` | Historial de actividad del lead |
| `app/conversacion.tsx` | Chat de WhatsApp: ventana de 24 h, plantillas, respuestas rápidas, adjuntos |
| `app/nuevo.tsx` | Alta manual |
| `app/avisos.tsx` + `public/sw.js` | Activar y recibir avisos al celular |
| `app/estado.tsx` | "Estado del sistema" (los chequeos de la revisión diaria) |
| `app/login/page.tsx` | Ingreso por enlace o código de 8 dígitos (entra solo al completarlo) |

## Rutas del servidor

| Ruta | Quién la llama | Acceso |
|---|---|---|
| `POST /api/leads/webhook` | sitio | origen + token público + topes |
| `POST /api/leads/crear`, `/api/leads/actualizar` | panel | sesión de un correo del panel |
| `GET/POST /api/whatsapp/webhook` | Meta | verify token / firma HMAC |
| `GET/POST /api/instagram/webhook` | Meta | verify token / firma HMAC |
| `GET/POST /api/facebook/webhook` | Meta | verify token / firma HMAC |
| `GET/POST /api/whatsapp/conversacion` | panel | sesión |
| `POST /api/push/suscribir`, `/api/push/probar` | panel | sesión |
| `POST /api/correos/usado`, `/api/errores` | sitio | origen + token + tope |
| `GET /api/diagnostico/fichas`, `POST .../aplicar` | Daniel | sesión |
| `GET /api/salud` | cron diario / panel | cron o sesión |
| `GET /api/whatsapp/recordatorio` | cron cada hora | cron o sesión |
| `GET /api/resumen` | cron lunes | cron o sesión |
| `GET /api/respaldo` | cron domingo | cron o sesión |

**Sesión** = JWT de Supabase + correo en `PANEL_EMAILS` (`lib/sesion.ts`). **Cron** =
`lib/cron.ts`.

## Tareas automáticas (`vercel.json`, horas UTC)

| Cuándo | Qué | Avisa |
|---|---|---|
| Diario 11:00 (8:00 Chile) | Revisión de salud: claves, base, leads entrando, latidos de tareas, respaldo, errores del sitio, cupo de correos, WhatsApp, **Instagram y Messenger** (apretón de manos real contra su webhook), sitio, reglas sitio=panel, dominio, avisos. Además: nombre de Meta y leads A sin llamar | Solo si algo falla o hay novedad |
| Cada hora | Recordatorios de la ficha y ventanas de WhatsApp por vencer | Por cada uno |
| Lunes 12:00 | Resumen semanal con embudo | Siempre |
| Domingo 07:00 | Respaldo de los datos al bucket privado `respaldos` | Solo si falla |

## Base de datos (Supabase, `supabase/`)

Tablas: `leads`, `mensajes`, `actividad`, `cotizaciones`, `visitas`, `config`, `push_subs`.
RLS: solo los correos de `es_del_panel()` (migración 007). Registros nuevos apagados en Supabase.
Los webhooks y crons usan la service role key (salta RLS; solo vive en Vercel).

`config` guarda: `emailjs_uso` (cupo de correos), `errores_sitio`, `meta_nombre`,
`latido_recordatorio`, `latido_resumen`.

Buckets privados: `respaldos` (JSON semanal), `adjuntos` (archivos de WhatsApp).

## Variables de entorno (Vercel, proyecto dls-control)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`DLS_WEBHOOK_TOKEN`, `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_WABA_ID`, `WA_APP_SECRET`,
`WA_VERIFY_TOKEN`, `IG_APP_SECRET`, `IG_VERIFY_TOKEN`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `FB_VERIFY_TOKEN`.
**`FB_APP_SECRET` no existe en Vercel a propósito** (verificado el 2026-09-14): Messenger y
WhatsApp viven en la misma app de Meta, así que el webhook cae de vuelta en `WA_APP_SECRET`.
Si algún día Messenger se muda a su propia app, hay que crearla.
La revisión diaria vigila que estén todas (`lib/salud.ts`).
Opcionales: `PANEL_EMAILS`, `CRON_SECRET`, `EMAILJS_LIMITE`, `EMAILJS_DIA_REINICIO`.
Pendiente: `IG_ACCESS_TOKEN`/`FB_PAGE_ACCESS_TOKEN` (identificadores de acceso) — no se
guardaron todavía; se generan de nuevo en el panel de Meta el día que se implemente responder
DM desde el panel.

## Pruebas

`npm test` (node:test con tsx). También corren en GitHub Actions en cada push
(`.github/workflows/pruebas.yml`); no bloquean el despliegue de Vercel, pero dejan la marca roja.

## Servicios externos

Meta (WhatsApp Cloud API, WABA 1064608879652326), Supabase (sa-east-1), Vercel Pro,
EmailJS (plan gratis, 2 plantillas, 200 correos por ciclo), Google Analytics
G-2JWSJNQBQC, Google Search Console, NIC Chile (dominio vence 2028-09-03), mindicador.cl (UF).
