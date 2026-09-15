# Arquitectura de DLS Control y del sitio

Mapa de todo el sistema al 15 de septiembre de 2026. Para entender qué hace cada pieza y
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
  CONTACTO hasta que la persona deje un teléfono o correo en el DM. Cuenta
  `dls.remodelaciones` (id 17841457090313946). **Entrada y salida funcionando**: probado de
  punta a punta el 2026-09-14, con un DM real respondido desde el panel y recibido por la
  persona.

  Tres cosas que costaron una tarde y conviene no volver a pagar:
  1. **No hay ninguna app "DLS Control-IG" separada.** `2053433005356915` es el id de la
     *identidad de Instagram* dentro de la app DLS Control, no una app: buscarla en la lista
     de aplicaciones no la encuentra. Todo se configura en DLS Control → Casos de uso →
     "Administrar mensajes y contenido en Instagram".
  2. **Instagram habla por `graph.instagram.com`, no por `graph.facebook.com`.** El
     identificador es de Instagram Login y Facebook ni siquiera puede interpretarlo: responde
     `(#190) Cannot parse access token`, que parece un token mal copiado y no lo es.
  3. En esa misma pantalla conviven la **clave secreta de la aplicación** (32 caracteres) y el
     **identificador de acceso** (~200, empieza en `IG`). Copiar la primera da exactamente el
     mismo error de Meta. Por eso `lib/dm.ts` revisa la forma del identificador antes de
     llamar: largo y prefijo, nunca el contenido.
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
| `app/bandeja-canales.tsx` | Las secciones por canal, con su ícono de rótulo y el cierre recordado |
| `app/canal.tsx` | La insignia de canal: los ocho íconos SVG, escritos a mano |
| `app/use-cerrados.ts` | Qué secciones quedaron cerradas (`useSyncExternalStore`, no efecto) |
| `app/ficha.tsx` | Ficha editable, "¿por qué este puntaje?", recordatorio con fecha |
| `app/historial.tsx` | Historial de actividad del lead |
| `app/conversacion.tsx` | Chat de WhatsApp: ventana de 24 h, plantillas, respuestas rápidas, adjuntos |
| `app/nuevo.tsx` | Alta manual |
| `app/avisos.tsx` + `public/sw.js` | Activar y recibir avisos al celular |
| `app/estado.tsx` | "Estado del sistema" (los chequeos de la revisión diaria) |
| `app/login/page.tsx` | Ingreso por enlace o código de 8 dígitos (entra solo al completarlo) |

### Cómo se ordena lo que se ve (14 y 15-sep-2026)

El panel mostraba treinta tarjetas idénticas: el canal se guardaba desde el
primer día pero no se dibujaba en ninguna parte, y con cinco entradas al mismo
buzón la lista era un muro plano. Las reglas quedaron en `lib/`, sin React, para
poder probarlas — un error acá esconde un cliente sin que nada falle a la vista.

| Archivo | Qué decide |
|---|---|
| `lib/canal-visual.ts` | Nombre, color y forma del ícono de cada canal. Un canal sin mapear igual se muestra |
| `lib/urgencia.ts` | Cuánto queda de la ventana de 24 h de Meta, y si va en rojo |
| `lib/agrupar-canal.ts` | Las secciones de canal y su orden (`ascPor` cambia el criterio interno) |
| `lib/etapas.ts` | Las etapas del pipeline, en el orden del negocio |
| `lib/cuando.ts` | "hoy 14:32" en vez de "hace 14 h", para poder comparar llegadas |
| `lib/cerrados.ts` | Qué secciones quedan dobladas. Solo se anota lo cerrado |
| `lib/prueba.ts` | Qué leads son pruebas del sistema y no cuentan como clientes |
| `lib/quieto.ts` | Cuántos días lleva un lead sin que nadie lo mueva |
| `lib/contacto-publicado.ts` | Que el sitio y la página de ingreso solo publiquen datos de la empresa |

Cinco criterios que no son obvios y conviene no "arreglar":

- **Entre canales manda quien espera, no el volumen**, y entre los que esperan,
  aquel a quien antes se le cierra la ventana de Meta. Un canal con dos personas
  esperando va sobre uno con treinta cotizaciones dormidas.
- **En "Para hoy" el orden es al revés** que en la bandeja: manda la hora del
  recordatorio y lo vencido va arriba. Por eso `agruparPorCanal` acepta `ascPor`.
- **Todo lo desconocido cae del lado visible**: un canal nuevo, un estado que no
  está en `ETAPAS`, un valor corrupto en el navegador, un lead con fecha
  inválida. Siempre se ve de más, nunca de menos. Esconder un cliente es el
  error caro y no falla nada a la vista cuando ocurre.
- **Las cifras cuentan clientes; la Bandeja muestra lo que entró.** Los leads
  marcados como prueba salen de las tres cifras, de Hoy, del pipeline, del aviso
  diario y del resumen semanal — y del filtro por clase, porque ese filtro nace
  de tocar una cifra y tenía que contar lo mismo que ella. En la Bandeja sin
  filtro siguen apareciendo con su insignia: es el registro completo y desde ahí
  se marcan.
- **La marca de prueba es explícita, nunca por nombre.** Detectar "prueba" o
  "test" en el nombre esconde el lead de una clienta apellidada Testa sin que
  nada falle. Misma razón por la que la migración 003 borra uno por uno.
  Se guarda en `actividad`, como "marcar como atendido": sin migración y con
  registro de cuándo.

"Hoy" y "Bandeja" se agrupan por canal; el pipeline, por etapa.

## Rutas del servidor

| Ruta | Quién la llama | Acceso |
|---|---|---|
| `POST /api/leads/webhook` | sitio | origen + token público + topes |
| `POST /api/leads/crear`, `/api/leads/actualizar` | panel | sesión de un correo del panel |
| `GET/POST /api/whatsapp/webhook` | Meta | verify token / firma HMAC |
| `GET/POST /api/instagram/webhook` | Meta | verify token / firma HMAC |
| `GET/POST /api/facebook/webhook` | Meta | verify token / firma HMAC |
| `GET/POST /api/whatsapp/conversacion` | panel | sesión |
| `POST /api/dm/enviar` | panel | sesión |
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
| Diario 11:00 (8:00 Chile) | Revisión de salud (21 chequeos): claves, base, leads entrando, latidos de tareas, respaldo, errores del sitio, cupo de correos, WhatsApp, **Instagram y Messenger** (apretón de manos real contra su webhook), sitio, reglas sitio=panel, dominio, avisos, **datos de contacto publicados** (sitio y página de ingreso). Además, en avisos aparte: nombre de Meta, leads A sin llamar y **presupuestos enviados hace 7 días sin respuesta** | Solo si algo falla o hay novedad |
| Cada hora | Recordatorios de la ficha y ventanas de WhatsApp por vencer | Por cada uno |
| Lunes 12:00 | Resumen semanal con embudo | Siempre |
| Domingo 07:00 | Respaldo de los datos al bucket privado `respaldos` | Solo si falla |

### Los 21 chequeos de la revisión diaria

Contados uno por uno el 15-sep-2026 leyendo las llamadas a `anotar()` en
`lib/salud.ts`, porque el número andaba de memoria por ahí y las llamadas en
ramas condicionales lo hacen parecer más grande (32 llamadas, 21 chequeos):

1. Claves del servidor · 2. Base de datos · 3. Leads entrando · 4. Tareas
automáticas · 5. Respaldo semanal · 6. Errores en el sitio · 7. Cupo de correos ·
8. WhatsApp: token · 9. WhatsApp: entrada de mensajes · 10. Instagram: entrada de
mensajes · 11. Messenger: entrada de mensajes · 12. Instagram: responder DM ·
13. Sitio web · 14. Datos para Google · 15. Datos de contacto publicados ·
16. Scripts del sitio · 17. Reglas de puntaje · 18. Sitio → panel · 19. Sitio →
WhatsApp · 20. Dominio · 21. Avisos al celular

Los dos de "entrada de mensajes" de Instagram y Messenger salen de un bucle sobre
`WEBHOOKS_META`: agregar un canal ahí suma un chequeo solo.

### Qué avisa al celular, y por qué van separados

Cuatro avisos posibles cada mañana, cada uno con su propio `tag` para que el
celular los agrupe y no se apilen:

| Aviso | Cuándo | `tag` |
|---|---|---|
| Falla del sistema | cualquiera de los 21 chequeos en rojo | `salud` |
| Nombre de WhatsApp | Meta cambió el estado del nombre visible | `meta-nombre` |
| Leads A sin llamar | clasificación A, aptos, más de 48 h sin llamada | `a-sin-llamar` |
| Presupuestos dormidos | `presupuesto_enviado` con 7 días sin movimiento | `presupuestos-dormidos` |

Los dos últimos van **aparte a propósito**. Son dos trabajos distintos —llamar a
alguien nuevo versus insistir sobre algo ya cotizado— y juntos en un mensaje se
atiende solo el primero. Ninguno incluye leads marcados como prueba: un aviso que
pide una llamada imposible es el que enseña a ignorar los avisos.

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
Opcionales: `PANEL_EMAILS`, `EMAILJS_LIMITE`, `EMAILJS_DIA_REINICIO`.
`CRON_SECRET` **ya existe** (14-sep-2026): los crons se autentican con
`Authorization: Bearer` y un impostor recibe 401 (verificado contra producción, no solo con
pruebas). `lib/cron.ts` sigue aceptando el user-agent de Vercel como respaldo. Al crearla en
Vercel hay que escribirla **sin espacios ni salto de línea final**: el despliegue falla con
"contains leading or trailing whitespace, which is not allowed in HTTP header values". Con
PowerShell, `$s | vercel env add` agrega un salto; desde Bash, `printf '%s' "$S" | vercel env add`
no.
`IG_ACCESS_TOKEN` (2026-09-14): responder DM de Instagram desde el panel, funcionando. Se
genera en Casos de uso → Instagram → "2. Genera identificadores de acceso" → "Generar
identificador" en la fila de la cuenta; se muestra una sola vez.

Pendiente: `FB_PAGE_ACCESS_TOKEN`, para responder Messenger. Se genera en Casos de uso →
Messenger → paso 2. **Pero guardarlo no alcanza**: `pages_messaging` sin Advanced Access solo
deja escribirle a quien tenga un rol en la app, así que Messenger sigue bloqueado por la
revisión de Meta, que a su vez espera la verificación del negocio. Instagram no tuvo esa
restricción.

## Deudas conocidas

- **La versión de la Graph API está repartida**: `lib/salud.ts` usa v23.0 y `lib/whatsapp.ts`
  y `lib/adjuntos.ts` siguen en v21.0. Unificarlas exige probar antes que los endpoints de
  ENVÍO (`/messages`) respondan igual en v23, y eso no se puede hacer a ciegas: si v23 cambiara
  algo, los mensajes a clientes dejarían de salir. El token de `.env.local` está vencido (401),
  así que la prueba hay que hacerla con el de producción. Meta deprecia cada versión unos 2
  años después de publicarla.
- **Nada verifica el teléfono publicado en Instagram y Messenger.** La revisión diaria ya
  compara el número del sitio con el de Meta, pero el de los perfiles de esas redes se
  configura fuera y necesitaría `FB_PAGE_ACCESS_TOKEN`, que todavía no se guardó.
- **El botón de WhatsApp del perfil de Instagram sigue apuntando al número personal**
  (14-sep-2026). El correo y el teléfono del perfil ya quedaron con los datos de la empresa
  —`contacto@dlsremodelaciones.cl` y +56 9 5638 1974— y el número quedó vinculado en Cuenta
  profesional con tick verde, pero el botón del perfil siguió abriendo el chat personal. No
  sale de "Botones de acción" (está en "Ninguno activo") ni de "Opciones de contacto", ni de
  la página de Facebook, que ya apunta al número correcto. Queda comprobar si era caché de la
  app; si no, desvincular y volver a vincular. **Importa de verdad**: cada persona que aprieta
  ese botón escribe a un privado y ese mensaje no entra al panel, así que no queda registrado
  como lead.

## Pruebas

`npm test` (node:test con tsx). 381 al 15-sep-2026. También corren en GitHub Actions en cada
push (`.github/workflows/pruebas.yml`); no bloquean el despliegue de Vercel, pero dejan la
marca roja.

**Al escribir una prueba con fechas, no uses un desfase a mano (`-03:00`).** Chile cambia de
huso el primer domingo de septiembre, así que dos fechas del mismo mes pueden estar en
desfases distintos y la prueba falla por el cambio de hora, no por el código. Construye la
fecha en hora local (`new Date(2026, 8, 14, 15, 30)`); costó un test rojo descubrirlo.

## Servicios externos

Meta (WhatsApp Cloud API, WABA 1064608879652326), Supabase (sa-east-1), Vercel Pro,
EmailJS (plan gratis, 2 plantillas, 200 correos por ciclo), Google Analytics
G-2JWSJNQBQC, Google Search Console, NIC Chile (dominio vence 2028-09-03), mindicador.cl (UF).
