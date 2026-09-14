# Cierre de DLS Control — qué falta para 10/10

Este documento existe porque el trabajo se sentía interminable: muchos días de
prueba y error sin una lista clara de qué es "terminado". Acá está esa lista.

**Cómo se usa.** Cada punto tiene un criterio de listo que se puede verificar, y
un dueño. Nada se marca hecho porque "debería funcionar": se marca cuando el
criterio se cumple mirando el sistema real. Mientras quede un punto abierto, el
trabajo no está cerrado.

**Regla que ordena todo lo demás:** cinco de los seis puntos abiertos dependen de
un solo trámite. Ver "El cuello de botella".

Última revisión: 2026-09-14.

---

## El cuello de botella

**La verificación del portafolio empresarial ante Meta.** Se hace en Meta
Business Suite con RUT, razón social y dirección legal de DLS Arquitectura y
Construcción SpA. **Solo la puede hacer Daniel** — son datos legales y no se
inventan.

> **Enviada el 2026-09-14 y en revisión.** Meta responde en ~2 días laborables.
> Todo lo que cuelga de acá queda esperando esa respuesta; no hay nada que hacer
> mientras, ni forma de apurarlo.

De ella cuelga, en cadena:

1. Poder **enviar** la solicitud de revisión de la aplicación (hoy el formulario
   está completo salvo esto, y sin la verificación el botón no se habilita).
2. Que Meta apruebe `pages_messaging`.
3. Que un cliente cualquiera que escriba a la página de Facebook **genere un
   lead** (hoy solo generan lead quienes tengan un rol en la app).
4. Que se le pueda **responder** ese Messenger desde el panel.
5. Que tenga sentido generar `FB_PAGE_ACCESS_TOKEN` (antes de eso no sirve).

Instagram ya demostró que, una vez destrabado el permiso, **todo lo demás ya está
construido y funciona**: el mismo código que responde Instagram responde
Messenger. No falta programación. Falta el trámite.

> Si solo se puede hacer una cosa, es esta.

---

## Estado por canal

Criterio de 10/10 para un canal: **entra el lead, avisa, se puede responder desde
el panel, y la revisión diaria se da cuenta si se cae.**

| Canal | Entra | Avisa | Responde | Vigilado | Estado |
|---|---|---|---|---|---|
| Sitio y cotizador | ✅ | ✅ | n/a | ✅ | **10/10** |
| WhatsApp | ✅ | ✅ | ✅ | ✅ | **10/10** |
| Instagram | ✅ | ✅ | ✅ | ✅ | **10/10** |
| Correo | ✅ | ✅ | n/a | ✅ | **10/10** |
| Messenger | ⚠️ solo roles | ✅ | ⚠️ bloqueado | ✅ | **bloqueado por Meta** |

Messenger tiene el código completo y probado. Lo único que le falta es el permiso.

---

## Lo que queda abierto

### 1. Verificar el negocio ante Meta — **enviado el 2026-09-14, en revisión**
**Listo cuando:** el portafolio aparece verificado en Meta Business Suite.
**Estado:** "Confirmación de identidad en curso". Meta revisa en ~48 h y notifica.
**Lo que costó llegar, para no repetirlo:**
- El botón "Iniciar verificación" de la solicitud lleva al Centro de seguridad, no al
  formulario. El trámite está **al final** de esa página, en la tarjeta "Verificación de la
  empresa" — hay que bajar hasta abajo para verla.
- Antes no aparecía porque los datos de la empresa estaban incompletos (la dirección decía
  solo "Chile" y no había teléfono). Al completarlos, Meta dijo "cumple los requisitos".
- El campo **Identificación fiscal** de "Información de la empresa" es el que permite que
  Meta cruce la empresa contra los registros chilenos. Con el RUT puesto, el buscador
  encontró el registro real.
- **Trampa peligrosa:** el buscador de registros devolvió 32 resultados y los primeros eran
  empresas de terceros con el texto "Actividad comercial como: DLS ARQUITECTURA Y
  CONSTRUCCION SPA" — repetía el término buscado. Hay que verificar **nombre + identificación
  fiscal + dirección + responsable** antes de elegir; algunas tenían incluso el mismo dígito
  verificador. Elegir la equivocada habría vinculado el negocio a la identidad legal de otra
  empresa.
- Las fotos de la cédula enviadas por WhatsApp llegan a **1280×960** y Meta exige 1500×1000:
  WhatsApp comprime a 1280 px de lado. Hay que pasar el archivo por cable o nube, o hacer el
  trámite desde el propio teléfono.

### 2. Enviar la solicitud de revisión — **Daniel decide, Claude ejecuta**
**Listo cuando:** la solicitud aparece "En revisión" en Meta for Developers.
**Bloqueado por:** el punto 1 (enviado, esperando respuesta de Meta) y por que Meta
registre la llamada de prueba a la API, que tarda hasta 24 h en aparecer y luego
vale 30 días. Con esas dos cosas, el formulario queda completo.
**Cuidado:** es irreversible — enviada, no se puede editar ni cancelar. No se
envía sin que Daniel vea el formulario completo y lo apruebe.

### 3. El número de la empresa en el perfil de Instagram — **Daniel**
**Listo cuando:** el perfil muestra +56 9 5638 1974 en los dos campos: el botón
de WhatsApp y el teléfono de contacto (son distintos).
**Estado:** hoy aparece un número personal. Todo lo que controla el sistema
—sitio, cotizador, chatbot, correos, datos para Google— ya usa el de la empresa;
ese perfil se configura fuera y su dominio está bloqueado para Claude.
**Por qué importa:** los clientes están escribiendo por Instagram.

### 4. `FB_PAGE_ACCESS_TOKEN` — **Daniel, pero después del punto 1**
**Listo cuando:** existe en Vercel y la revisión diaria dice "identificador vivo".
**No hacerlo antes:** sin el permiso aprobado no sirve de nada.

### 5. Verificar en pantalla lo último — **Daniel**
**Listo cuando:** en el panel se ve la conversación de Instagram dentro de la
ficha, y una foto enviada por DM aparece guardada.
**Por qué queda pendiente:** son cambios de interfaz y el entorno de Claude no
permite abrir el panel con sesión. Todo lo demás (tipos, 278 pruebas, build,
rutas protegidas) sí está verificado.

### 6. Llamar a Tamara Mednik — **Daniel**
**Listo cuando:** queda registrada la llamada en su ficha.
**Por qué está acá:** clasificación A con 87 puntos, pasó el filtro completo y
lleva días esperando. El sistema existe para esto.

---

## Lo que NO está abierto, y por qué

Para que no se confunda "pendiente" con "decidido que no".

- **Unificar la versión de la Graph API** (v21 en envíos, v23 en la revisión de
  salud): se descartó a propósito. Cambiarla sin poder probar los envíos reales
  arriesga que dejen de salir los mensajes a clientes, y las credenciales locales
  están vencidas. Queda anotado en ARQUITECTURA.md con cómo probarlo el día que
  se haga.
- **Vigilar el teléfono publicado en los perfiles de Meta**: necesitaría el token
  de la página, que depende del punto 1.
- **Rendimiento del panel con miles de leads**: hoy hay decenas. Se revisa cuando
  el volumen lo justifique, no antes.
- **Pruebas de `cors.ts`, `supabase.ts`, `supabase-admin.ts`**: son envoltorios de
  tres líneas sin lógica propia.

---

## Cómo se ve "terminado"

Cuando los seis puntos estén cerrados:

- Un cliente escribe por **cualquiera** de los cinco canales y entra como lead,
  clasificado, sin excepciones ni "solo si tiene un rol en la app".
- Daniel recibe el aviso en el celular y puede **responder desde el panel** por
  los tres canales conversacionales, dentro de la ventana de 24 horas.
- La revisión diaria de las 8:00 avisa si **cualquiera** de esas piezas se cae,
  incluidos los identificadores de acceso que caducan solos.
- Lo único que Daniel hace a mano es hablar con el cliente.

---

## Para retomar esto en una sesión nueva

Pegar esto:

> Lee `CIERRE.md` y `ARQUITECTURA.md` en la raíz de dls-control. Trabaja solo en
> los puntos abiertos de CIERRE.md, en orden. Antes de dar uno por hecho,
> verifica su criterio de listo contra el sistema real —no contra lo que el
> código sugiere que debería pasar— y di explícitamente cómo lo verificaste. Si
> un punto depende de Daniel, no lo simules ni lo rodees: díselo y detente ahí.
> Al terminar, actualiza este documento.
