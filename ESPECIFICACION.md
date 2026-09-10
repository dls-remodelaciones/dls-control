# PROMPT PARA CLAUDE CODE — CONSTRUIR "DLS CONTROL" COMO APP REAL
### De artifact dependiente del computador → a app propia, online 24/7, en el celular de Daniel

> **Instrucción de arranque:** Lee este documento completo antes de escribir una sola línea.
> Es la especificación total del proyecto. Al terminar de leerlo: confirma que entendiste,
> hazme **máximo 2 preguntas**, y empieza por la Fase 0. No me pidas aprobación paso a paso.

---

## PARTE 1 — DE DÓNDE NACE LA APLICACIÓN (contexto obligatorio)

### 1.1 El negocio

**DLS Arquitectura y Construcción** — Daniel Lehmann, Santiago de Chile. 6 años en
remodelaciones: cocinas, baños, quinchos, walking closets, estacionamientos, casas y
departamentos completos.

- Sitio: `https://dlsremodelaciones.cl`
- Correo del negocio: `contacto@dlsremodelaciones.cl` (Zoho, con reenvío automático **ya funcionando** a `dls.lehmann@gmail.com`)
- WhatsApp: `+56 9 8229 1198` (número personal; WhatsApp Business pendiente de activar)
- Instagram: cuenta activa del negocio (aún sin API)

### 1.2 Qué existe hoy y funciona

| Pieza | Estado real | Ubicación |
|---|---|---|
| **Sitio web** | LIVE en Vercel (`d.l.s-remodelaciones-2`) | `C:\Users\dlsle\OneDrive\Escritorio\PAGINA WEB` |
| **Cotizador web** | **En producción**, embebido en el sitio. 3 pasos. Email del cliente obligatorio. Al terminar el paso 3 envía la cotización automáticamente por **EmailJS** (probado OK). Template ID real: `template_xkq0gij` | `C:\Users\dlsle\OneDrive\Escritorio\COTIZADOR DLS CLAUDE` — **carpeta de trabajo obligatoria** |
| **Chatbot web** | Operativo. 6 preguntas (m², comuna, tipo+presupuesto, financiamiento, foto, referencia) → dispara WhatsApp | dentro del sitio |
| **DLS Control (v1)** | Panel funcionando como **artifact**. Lee el buzón vía conector de Gmail, separa leads de correo administrativo (Zoho/NIC/Cloudflare/Vercel/EmailJS), tiene ficha de lead y pipeline persistente | artifact "DLS Control" |
| **Ícono en el celular** | Daniel **ya tiene "DLS Control" instalado en la pantalla de inicio de su iPhone** (ícono gris, junto a Pinterest). Ese ícono debe seguir funcionando y apuntar a la app nueva | iPhone de Daniel |

### 1.3 EL PROBLEMA QUE HAY QUE RESOLVER (razón de ser de este proyecto)

**La v1 depende del computador de Daniel.**
El panel actual lee el correo a través del conector de Gmail de una sesión de Claude: si el
computador está apagado, dormido o desconectado, **no entran leads, no se puede autorizar nada
y el pipeline no avanza**. Daniel no puede operar su negocio desde el celular en la calle,
que es exactamente donde está el 90% del tiempo.

**Lo que hay que construir:** una aplicación **propia, con backend propio, online 24/7,
independiente de cualquier computador o sesión de Claude**, que:

1. Reciba los leads **en tiempo real** desde el cotizador, el chatbot, el formulario web y el correo.
2. Se los notifique a Daniel al celular **con push, aunque la app esté cerrada**.
3. Le permita **responder, enviar la cotización, enviar el presupuesto, agendar visita y hacer
   seguimiento — todo desde el teléfono, sin abrir el computador**.
4. Quede instalada en el ícono "DLS Control" que ya tiene en la pantalla de inicio.

> **Frase que resume el proyecto:** *hoy la app mira el correo prestado desde un computador;
> mañana la app es el sistema, y el computador es opcional.*

---

## PARTE 2 — LA INTERFAZ ACTUAL (punto de partida, hay que conservarla y mejorarla)

La v1 ya tiene la estructura visual correcta. **Consérvala**, no la reinventes:

**Barra lateral izquierda (íconos):** logo DLS · 💬 Mensajes (con punto de notificación) ·
📋 Cotizaciones · 📅 Agenda · 💼 Obras · ⚙️ Ajustes abajo.

**Fila superior de KPIs (4 tiles):**
`8 LEADS HOY` · `3 SIN RESPONDER` · `2 VISITAS ESTA SEMANA` · `5 BOT RESPONDIÓ HOY`

**Columna central — Mensajes:** filtros de canal `Todos / WhatsApp / Email / IG`, y lista de
conversaciones con avatar de iniciales, nombre, extracto del último mensaje, hora, contador de
no leídos y **etiqueta de estado** de colores: `NUEVO` (amarillo) · `SEGUIMIENTO` (azul) ·
`VISITA AGENDADA` (violeta) · `PRESUPUESTO ENVIADO` (naranjo).

**Panel derecho — Ficha del lead:** Tipo de proyecto · Superficie · Zona · Presupuesto, y debajo
el **PIPELINE** vertical con 5 pasos:
`Contacto inicial → Cotizador web → Visita en terreno → Presupuesto enviado → Proyecto cerrado`.

**Estética:** fondo hueso/beige claro, tipografía serif elegante para los números y títulos,
acentos discretos, mucho aire. Es la identidad DLS — mantenerla.

### 2.1 BUGS Y PROBLEMAS DE LA v1 QUE HAY QUE CORREGIR SÍ O SÍ

1. **🔴 CRÍTICO — el layout de 3 columnas está roto en celular.** En el iPhone el panel derecho
   se corta: se ve "Visita en terreno" cortado, "Presupuesto env…", "Proyecto cerrad…". Daniel
   usa esto en el teléfono. **Rediseñar mobile-first:** en celular una sola columna con navegación
   por pestañas inferiores; las 3 columnas solo desde tablet/desktop (`≥1024px`).
2. **🔴 Los KPIs no son accionables.** Son 4 números decorativos. Cada tile debe ser un **filtro
   tocable**: tocar "3 SIN RESPONDER" filtra la lista a esos 3. Un número que no lleva a ninguna
   parte es adorno.
3. **🔴 No hay botón de acción en la lista.** Hay que abrir el lead para hacer cualquier cosa.
   Cada fila debe traer swipe o botones directos: 📞 Llamar · 💬 WhatsApp · 📄 Enviar cotización.
4. **🟡 Datos de ejemplo sin marcar.** Cotizaciones / Agenda / Obras tienen data ficticia. Si un
   módulo no tiene datos reales, **banner amarillo "DATOS DE EJEMPLO"** arriba. La confianza en la
   app se pierde una sola vez.
5. **🟡 El pipeline se ve pero no se toca.** Debe poder avanzarse con un toque en el paso,
   con deshacer, sin modales de confirmación.
6. **🟡 Falta priorización.** Todos los leads pesan lo mismo. Falta el score (Parte 5).
7. **🟡 No hay estado vacío útil.** Si no hay leads sin responder, la pantalla debe decir qué
   hacer, no "sin resultados".

---

## PARTE 3 — ARQUITECTURA DE LA APP NUEVA

### 3.1 Stack (usar exactamente este, todo en capa gratuita)

- **Framework:** Next.js 14+ (App Router) + TypeScript + Tailwind CSS
- **Hosting:** Vercel (proyecto nuevo, separado del sitio; sugerido `dls-control`)
- **Base de datos:** **Supabase** (Postgres) — plan gratuito. Es la pieza que hace que todo
  sobreviva sin el computador.
- **Tiempo real:** Supabase Realtime (suscripción a la tabla `leads`) → la lista se actualiza
  sola cuando entra un lead, sin refrescar.
- **Notificaciones push:** Web Push API + Service Worker (VAPID keys, gratis). iOS 16.4+
  soporta push en PWA **solo si la app está instalada en la pantalla de inicio** — Daniel ya
  la tiene instalada, así que funciona.
- **PWA:** `manifest.json` + Service Worker + íconos. Debe abrirse a pantalla completa, sin
  barra de Safari, y reemplazar el ícono actual "DLS Control" del iPhone.
- **Correo saliente:** Resend o EmailJS (ya hay cuenta configurada con `contacto@`).
- **Correo entrante:** Gmail API con **refresh token guardado en el servidor** (OAuth una sola
  vez desde el navegador) + cron de Vercel cada 5 min. **Esto es lo que corta la dependencia
  del computador.**
- **Auth:** Supabase Auth, un solo usuario (`dls.lehmann@gmail.com`) con magic link. La app es
  privada, nunca pública.

> **Restricción de costo:** todo en capa gratuita. **No contrates nada.** Si algo requiere pago
> (API de WhatsApp Business, Instagram Graph API, dominio nuevo), preséntame la propuesta con
> el costo y **espera mi aprobación**. Nunca lo actives por tu cuenta.

### 3.2 Diagrama del flujo

```
  Cotizador web ──POST /api/leads/webhook──┐
  Chatbot web   ──POST /api/leads/webhook──┤
  Formulario web──POST /api/leads/webhook──┼──▶ Normalizador ──▶ SCORING ──▶ Supabase
  Correo Gmail  ──cron cada 5 min─────────┘                                    │
  WhatsApp/IG   ──pegado manual asistido──┘                                     │
                                                                    ┌───────────┴──────────┐
                                                                    ▼                      ▼
                                                          Supabase Realtime          Web Push
                                                                    │                      │
                                                                    └──────▶ 📱 iPhone ◀────┘
                                                                          (PWA DLS Control)
                                                                                │
                                    ┌───────────────────────────────────────────┤
                                    ▼                    ▼                      ▼
                              📞 Llamar          💬 WhatsApp prellenado   📄 Enviar cotización
                              (tel:)             (wa.me)                  (email desde la app)
```

### 3.3 Esquema de base de datos (Supabase)

```sql
create table leads (
  id uuid primary key default gen_random_uuid(),
  canal text not null,                  -- web | cotizador | chatbot | correo | whatsapp | instagram | manual
  nombre text, telefono text, email text,
  tipo_proyecto text,                   -- cocina|baño|quincho|walking_closet|estacionamiento|casa_completa|depto_completo|otro
  comuna text, superficie_m2 numeric,
  rango_presupuesto text,               -- ej "$15M – $25M"
  financiamiento text,                  -- propio|credito|por_definir
  plazo text,                           -- inmediato|1-3_meses|3-6_meses|explorando
  propiedad text,                       -- propia|arriendo|por_comprar
  score int default 0,
  clasificacion text,                   -- A|B|C|D
  estado text default 'contacto_inicial',
  -- contacto_inicial | cotizador_web | visita_terreno | presupuesto_enviado | cerrado | no_prosperó
  etiqueta text,                        -- NUEVO|SEGUIMIENTO|VISITA AGENDADA|PRESUPUESTO ENVIADO
  respondido boolean default false,
  nota_interna text, fotos jsonb default '[]',
  proxima_accion text, fecha_proxima_accion timestamptz,
  creado timestamptz default now(), ultima_actividad timestamptz default now()
);

create table mensajes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  direccion text,          -- entrante | saliente
  canal text, cuerpo text,
  enviado_por text,        -- daniel | bot | sistema
  creado timestamptz default now()
);

create table cotizaciones (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  tipo_proyecto text, superficie_m2 numeric,
  monto_min numeric, monto_max numeric, uf_m2 numeric,
  partidas jsonb, pdf_url text,
  enviada boolean default false, enviada_en timestamptz,
  creado timestamptz default now()
);

create table visitas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  fecha timestamptz, direccion text, estado text, notas text
);

create table config ( clave text primary key, valor jsonb );
-- guarda: rangos de precio por tipo, comunas de operación, refresh token de Gmail, VAPID keys
```

Activar **Row Level Security** en todas las tablas: solo el usuario autenticado accede.

---

## PARTE 4 — CONEXIÓN CON EL COTIZADOR (la pieza que pide Daniel explícitamente)

Hoy el cotizador vive en `C:\Users\dlsle\OneDrive\Escritorio\COTIZADOR DLS CLAUDE` y solo manda
un correo. Hay que **enlazarlo en ambas direcciones** con la app:

### 4.1 Cotizador → App (entrada de lead en tiempo real)

En `dls-cotizador-embed.js`, al terminar el paso 3, **además** del envío por EmailJS actual
(no lo rompas, es el respaldo), agregar:

```js
fetch('https://dls-control.vercel.app/api/leads/webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-DLS-Token': DLS_WEBHOOK_TOKEN },
  body: JSON.stringify({
    canal: 'cotizador',
    nombre, email, telefono, tipo_proyecto, comuna, superficie_m2,
    rango_presupuesto, financiamiento, plazo,
    cotizacion: { monto_min, monto_max, uf_m2, partidas }
  })
});
```

El endpoint debe: validar el token → normalizar → **deduplicar por teléfono o email** (si el
lead ya existe, agrega el mensaje y recalcula score, no crea uno nuevo) → calcular score →
guardar → disparar **push al iPhone de Daniel** → aparecer en la lista sin refrescar.

Mismo endpoint para el **chatbot** (`canal: 'chatbot'`) y el formulario de contacto.

### 4.2 App → Cotizador (Daniel cotiza desde el celular)

Desde la ficha de un lead, botón **"Generar cotización"**:
- Precarga tipo de proyecto, m² y comuna que el lead ya declaró.
- Calcula el rango con la **misma lógica de precios del cotizador web** — extraer esa lógica a
  un módulo compartido (`lib/pricing.ts`) para que exista **una sola fuente de verdad**; hoy
  duplicar precios es el error más caro que se puede cometer.
- Genera el **PDF de la cotización** con la marca DLS.
- Botón **"Enviar por correo"** y botón **"Enviar por WhatsApp"** (mensaje ya redactado + link
  al PDF). Al enviarse: guarda en `cotizaciones`, mueve el pipeline a `presupuesto_enviado` y
  cambia la etiqueta del lead. **Todo desde el teléfono, en 3 toques.**

### 4.3 Prellenado del cotizador desde un link

`https://dlsremodelaciones.cl/cotizador?tipo=cocina&m2=18&comuna=providencia&lead=<uuid>` —
así el chatbot y la landing de Instagram encadenan al cotizador sin que el cliente repita datos,
y la cotización queda amarrada al lead correcto.

---

## PARTE 5 — MOTOR DE CALIFICACIÓN (para que la llamada sea de cierre)

Score 0–100 calculado automáticamente al entrar el lead. Objetivo: **que Daniel nunca llame en frío.**

| Señal | Peso | Puntaje |
|---|---|---|
| Presupuesto declarado | 30 | sobre rango 30 · en rango 22 · bajo 8 · "no sé" 5 |
| Plazo | 20 | inmediato 20 · 1–3 meses 15 · 3–6 meses 8 · explorando 3 |
| Comuna | 15 | zona principal 15 · secundaria 9 · fuera de radio 0 → **descarte automático** |
| Propiedad | 10 | propia 10 · por comprar 6 · arriendo 2 |
| Superficie coherente con el tipo | 10 | coherente 10 · sin dato o incoherente 4 |
| Completitud (tel + email + tipo + comuna) | 10 | proporcional |
| Interacción (subió fotos, terminó el cotizador, respondió follow-up) | 5 | — |

**Acción automática por clasificación:**
- **A (≥75)** → push inmediato "LLAMAR HOY" + **brief de cierre** generado por la app: qué pidió,
  presupuesto, plazo, 3 obras similares para mencionar, rango ya entregado, y las 2 objeciones
  más probables con su respuesta.
- **B (50–74)** → secuencia automática sin Daniel: cotización preliminar + portafolio del tipo de
  proyecto + 1 pregunta de desempate a las 48 h. Si responde y sube de 75, pasa a A.
- **C (30–49)** → respuesta automática + seguimiento a 30 días. Nunca llega al teléfono.
- **D (<30) o fuera de radio** → respuesta cortés automática y archivo.

Regla dura: **ningún lead entra a la vista "Llamar hoy" sin teléfono válido y tipo de proyecto
definido.** Los pesos y rangos van en la tabla `config`, editables desde ⚙️ sin tocar código.

---

## PARTE 6 — CANALES: qué se puede y qué no (sin gastar)

| Canal | Cómo entra ahora, gratis | Ideal (requiere mi aprobación por costo) |
|---|---|---|
| Cotizador / Chatbot / Formulario | Webhook directo ✅ | — |
| **Correo** | Gmail API con refresh token en servidor + cron cada 5 min. Clasificador lead vs. administrativo (ignorar Zoho, NIC, Cloudflare, Vercel, EmailJS) | — |
| **WhatsApp** | Botón **"Pegar conversación"**: Daniel copia el chat, lo pega, la app lo parsea y crea el lead con score. Además, respuesta rápida guardada con el link del embudo | API de WhatsApp Business (cobro por conversación) |
| **Instagram** | **Landing de embudo**: la bio y toda respuesta de DM llevan a un link único con formulario de calificación → entra por webhook como cualquier otro lead | Graph API (cuenta Business + página FB + revisión de app) |

> **El insight clave:** no hace falta la API de Instagram ni la de WhatsApp para unificar los
> canales. Basta con que **todos desemboquen en el mismo formulario de calificación**. El embudo
> es el integrador; la API sería solo comodidad. Los filtros `WhatsApp / Email / IG` de la
> interfaz funcionan igual, porque el campo `canal` guarda el origen.

---

## PARTE 7 — QUÉ DEBE PODER HACER DANIEL DESDE EL CELULAR (checklist funcional)

Todo esto, **sin abrir el computador**:

- [ ] Recibir push cuando entra un lead, con la app cerrada.
- [ ] Ver la lista de leads del día ordenada por score, no por hora.
- [ ] Tocar un KPI y que filtre la lista.
- [ ] Llamar con un toque (`tel:` real).
- [ ] Mandar WhatsApp con el mensaje **ya redactado** con los datos del lead (`wa.me`). Cero copiar-pegar.
- [ ] Responder un correo desde la app (envío real, no un link a Gmail).
- [ ] Generar y enviar la cotización en PDF.
- [ ] Autorizar el envío automático de una cotización propuesta por la app (botón Aprobar / Editar / Descartar).
- [ ] Agendar visita en terreno (y que se sincronice a Google Calendar).
- [ ] Mover el pipeline con un toque, con deshacer.
- [ ] Escribir una nota interna del lead.
- [ ] Ver el brief de cierre antes de llamar.
- [ ] Marcar "no prosperó" con motivo (para aprender qué filtrar mejor).

---

## PARTE 8 — PLAN DE EJECUCIÓN POR FASES

> **Formato de trabajo de Daniel:** sesiones de ~1 hora, una tarea concreta por sesión.
> No abrumes con preguntas ni textos largos. Cada sesión retoma lo avanzado y actualiza el log final.
> Al terminar cada fase: **deploy a Vercel y avisar que se puede probar en el celular.**

**FASE 0 — Cimientos (sin esto no hay app)**
1. Crear proyecto Next.js + Tailwind + TypeScript. Repo git.
2. Proyecto Supabase, tablas del §3.3, RLS activa.
3. Auth con magic link para `dls.lehmann@gmail.com`.
4. Deploy inicial a Vercel. URL viva.

**FASE 1 — Entrada de leads en tiempo real**
5. `POST /api/leads/webhook` con token, normalización, dedupe y scoring.
6. Enganchar el cotizador (`dls-cotizador-embed.js`) al webhook, **sin romper el EmailJS actual**.
7. Enganchar el chatbot al mismo webhook.
8. Realtime: la lista se actualiza sola.

**FASE 2 — La app en el celular**
9. PWA: manifest, service worker, íconos DLS. **Que reemplace el ícono existente del iPhone.**
10. Web Push con VAPID + suscripción del dispositivo de Daniel.
11. **Rediseño mobile-first**: una columna + pestañas inferiores en celular; 3 columnas ≥1024px.
    Arreglar el panel derecho cortado.
12. KPIs tocables como filtros. Acciones directas en cada fila (llamar / WhatsApp / cotizar).

**FASE 3 — Operar de verdad desde el teléfono**
13. Gmail API con refresh token en servidor + cron 5 min + clasificador lead/administrativo.
    **Aquí muere la dependencia del computador.**
14. Responder correo desde la app (envío real).
15. `lib/pricing.ts` compartido + generación de cotización en PDF + envío por correo y WhatsApp.
16. Pipeline tocable con deshacer. Notas internas. Motivo de "no prosperó".

**FASE 4 — Automatizar y medir**
17. Landing de embudo para Instagram/WhatsApp (mismas preguntas, fotos editables por Daniel).
18. Botón "Pegar conversación de WhatsApp" → parseo y creación de lead.
19. Secuencias automáticas para leads B y C. Brief de cierre para leads A.
20. Agenda con Google Calendar. Reemplazar todos los datos de ejemplo por datos reales.
21. Métricas: leads por canal, tasa A/B/C/D, conversión por tipo de proyecto, tiempo
    lead→llamada, tasa de cierre. Ajustar pesos del score con los primeros 30 leads reales.

---

## PARTE 9 — REGLAS DE OPERACIÓN PARA TI, CLAUDE CODE

1. **90% autonomía / 10% Daniel.** Decide y ejecuta. Escala **solo** si hay: gasto real,
   decisión irreversible, o el cliente final ya está involucrado.
2. **No contrates ni actives nada de pago.** Propuesta con costo estimado y esperas.
3. **No inventes datos de negocio.** Precios, comunas de operación y rangos por tipo de proyecto
   van en `config/negocio.json` (o tabla `config`), editables por Daniel. Si falta un dato,
   pregúntalo una vez y déjalo parametrizado.
4. **No rompas lo que ya funciona.** El cotizador está en producción y el EmailJS está probado:
   se le **suma** el webhook, no se le reemplaza nada.
5. **Trabaja en las carpetas indicadas**, no crees estructuras paralelas.
6. **Ningún secreto en el repo.** Todo en variables de entorno de Vercel.
7. **Máximo 2 preguntas por sesión.** Si dudas, toma la opción razonable y dila.
8. **Muéstrame el resultado funcionando en el celular**, no la descripción de lo que hiciste.
9. **Cada sesión termina actualizando el log** al final de este documento.

---

## PARTE 10 — CRITERIOS DE ACEPTACIÓN

La app está lista cuando, **con el computador de Daniel apagado**:

- [ ] Un cliente termina el cotizador en la web y **el iPhone de Daniel suena en menos de 30 segundos**.
- [ ] Daniel abre el ícono "DLS Control" y ve el lead completo, con score y clasificación.
- [ ] Toca "Llamar" y el teléfono marca. Toca "WhatsApp" y el mensaje ya está escrito.
- [ ] Genera y envía la cotización en PDF sin salir de la app.
- [ ] Mueve el pipeline y el cambio persiste (se ve igual desde otro dispositivo).
- [ ] Los cuatro canales caen en la misma bandeja con el mismo esquema de datos.
- [ ] Ningún módulo muestra datos de ejemplo sin su banner de advertencia.
- [ ] La interfaz se ve completa en el iPhone: **nada cortado en el borde derecho.**

---

## PARTE 11 — LOG DE AVANCES
*(más reciente arriba — actualízalo al final de cada sesión)*

| Fecha | Fase | Avance |
|---|---|---|
| 2026-09-10 | 0 | **FASE 0 COMPLETA. App viva en https://dls-control.vercel.app** (ver detalle abajo). |
| 2026-09-10 | — | Especificación creada. Definido el salto de artifact dependiente del computador a app propia con backend, realtime y push. |

---

## FASE 0 — lo que quedó hecho (2026-09-10)

**URL viva:** https://dls-control.vercel.app · **Repo:** `dls-remodelaciones/dls-control`, rama `main`
**Local:** `C:\Users\dlsle\dls-control` — **fuera de OneDrive a propósito**: sincronizar `node_modules`
es lento y puede corromper el proyecto.

| Pieza | Estado |
|---|---|
| Next.js 16.3.4 + TypeScript + Tailwind 4 | ✅ |
| Supabase `dls-control`, `sa-east-1` (São Paulo) | ✅ 7 tablas, RLS activa |
| `lib/negocio.ts` — scoring §5 + precios, fuente única | ✅ compila sin errores |
| PWA: manifest + íconos PNG | ✅ |
| Deploy automático por `git push` | ✅ |
| Auth con magic link | ⬜ pendiente |

### Correcciones a la especificación (comprobadas, no supuestas)

- **WhatsApp:** la §1.2 dice `+56 9 8229 1198`. El número correcto es **`+56 9 9138 0205`**,
  confirmado por Daniel y ya corregido y publicado en el sitio.
- **Carpeta web:** es `PAGINA WEB CLAUDE`, no `PAGINA WEB`.
- **Chatbot:** la §1.2 lo describe con 6 preguntas terminando en WhatsApp. Ya es **v2**: 10 pasos,
  correo y teléfono obligatorios, pregunta plazo y propiedad, y manda ficha `[LEAD]` estructurada.
- **Bugs §2.1 números 1, 2, 3, 6 y 7:** ya resueltos. La pantalla es la vista móvil; la barra
  lateral y las 3 columnas serán la vista ≥1024px. No son diseños en conflicto, son dos anchos.
- **La v1 del repo nunca funcionó:** su `index.html` tenía literalmente `SUPABASE_URL_AQUI` como
  URL de la base. Quedó intacta en `_legacy/` como referencia.

### Trampas encontradas (para no repetirlas)

1. **`Framework Preset` estaba en "Other".** Heredado del HTML estático anterior. El deploy decía
   Ready y la raíz devolvía **404**. Se corrige en Settings → Build and Deployment y hay que
   **redesplegar**, porque el cambio no aplica al deployment ya publicado.
2. **`create table if not exists` enmascaró un conflicto.** Existía una tabla `leads` vieja con
   columnas en inglés (`name`, `phone`); Postgres saltó la creación en silencio y después falló
   el índice sobre `telefono`. Se verificó que las 4 tablas viejas estaban vacías antes de borrarlas.
3. **El límite de Supabase gratis es 2 proyectos por cuenta**, no por organización. El formulario
   de Vercel ofrecía solo planes de pago (USD 25/mes) por eso, y venía con la región en **Canadá**.
   Ya existía un proyecto `dls-control` en São Paulo: se reusó.
4. **"Connect Database" de Vercel no ve proyectos Supabase creados fuera del marketplace.** Las
   variables se pusieron a mano, pegando el `.env` en el campo Key (Vercel lo parsea solo).
5. **Los íconos SVG en data-URI no funcionan en iOS.** Era la causa del cuadro gris. Se generan
   como PNG con `ImageResponse` en `app/icon.tsx` y `app/apple-icon.tsx`.
6. **Daniel tendrá que volver a agregar el ícono** a la pantalla de inicio: un ícono guardado
   apunta a una URL fija y no se puede reapuntar.

### Pendientes que aparecieron

- **`ANTHROPIC_API_KEY` y tokens de WhatsApp/Meta** siguen en las variables de entorno de Vercel,
  del intento anterior. La de Anthropic **se cobra por uso** — conviene revisarla o borrarla.
- Las 7 variables viejas (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `WA_*`, `IG_*`) ya no las usa
  ningún código. Limpiar cuando se confirme que no hacen falta.
- La `SUPABASE_SERVICE_KEY` nueva (secreta) hará falta recién en la Fase 1, para el webhook y el
  cron, que necesitan saltarse el RLS.
