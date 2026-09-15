# Cierre de DLS Control — qué falta para 10/10

Este documento existe porque el trabajo se sentía interminable: muchos días de
prueba y error sin una lista clara de qué es "terminado". Acá está esa lista.

**Cómo se usa.** Cada punto tiene un criterio de listo que se puede verificar, y
un dueño. Nada se marca hecho porque "debería funcionar": se marca cuando el
criterio se cumple mirando el sistema real. Mientras quede un punto abierto, el
trabajo no está cerrado.

**Regla que ordena todo lo demás:** cinco de los ocho puntos abiertos dependen de
un solo trámite, ya enviado. Ver "El cuello de botella". Los otros tres son de
Daniel y se pueden hacer hoy.

Última revisión: 2026-09-15.

**Versión para el celular:** https://claude.ai/code/artifact/30ddb153-fd9b-4bdd-949a-faa89c0c0df1
(las casillas que se marcan ahí quedan guardadas y se pueden leer desde una sesión nueva).

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

| Canal | Entra | Avisa | Responde | Vigilado | Se distingue | Estado |
|---|---|---|---|---|---|---|
| Sitio y cotizador | ✅ | ✅ | n/a | ✅ | ✅ | **10/10** |
| WhatsApp | ✅ | ✅ | ✅ | ✅ | ✅ | **10/10** |
| Instagram | ✅ | ✅ | ✅ | ✅ | ✅ | **9/10** — el botón del perfil desvía al privado (punto 3) |
| Correo | ✅ | ✅ | n/a | ✅ | ✅ | **10/10** |
| Messenger | ⚠️ solo roles | ✅ | ⚠️ bloqueado | ✅ | ✅ | **bloqueado por Meta** |

Messenger tiene el código completo y probado. Lo único que le falta es el permiso.

"Se distingue" se agregó el 15-sep: el canal ahora se ve en la tarjeta, la lista
va agrupada por canal y el aviso al celular dice por dónde entró. Antes el dato
se guardaba y no se mostraba en ninguna parte, así que los cinco canales caían en
un buzón donde todo se veía igual.

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

### 3. El botón de WhatsApp del perfil de Instagram — **Daniel**
**Listo cuando:** al apretarlo en el celular se abre un chat con +56 9 5638 1974.
**Ya resuelto el 14-sep:** el **correo** del perfil (`contacto@dlsremodelaciones.cl`,
antes un Gmail personal), el **teléfono de contacto** (+56 9 5638 1974) y la casilla
"Mostrar información de contacto", que estaba apagada — sin ella el perfil no
mostraba ningún dato. Verificado en el panel "Contacto" del perfil móvil.
**Lo que sigue abierto:** el botón de WhatsApp, que es otra vinculación. Se dejó
vinculado el número de la empresa en Cuenta profesional (con tick verde) y el
botón siguió abriendo el chat personal.
**Lo ya descartado, para no repetir camino:**
- No sale de "Botones de acción" (está en "Ninguno activo").
- No sale de "Opciones de contacto", que ya tiene los datos correctos.
- No lo hereda de la página de Facebook, que apunta al número correcto.
- El campo "Número de WhatsApp" de la web dio "Se ha producido un error" en el
  primer intento y quedó vinculado en el segundo. El botón no cambió en 1 minuto.
**Lo que queda por probar:** si era caché de la app (cerrarla del todo y reabrir).
Si no, desvincular y volver a vincular desde el computador.
**Por qué importa de verdad:** quien aprieta ese botón escribe a un privado y ese
mensaje **no entra al panel**: no queda registrado como lead ni avisa nada.

### 4. `FB_PAGE_ACCESS_TOKEN` — **Daniel, pero después del punto 1**
**Listo cuando:** existe en Vercel y la revisión diaria dice "identificador vivo".
**No hacerlo antes:** sin el permiso aprobado no sirve de nada.

### 5. Verificar en pantalla lo último — **Daniel**
**Listo cuando:** en el panel se ve la conversación de Instagram dentro de la
ficha, y una foto enviada por DM aparece guardada.
**Por qué queda pendiente:** son cambios de interfaz y el entorno de Claude no
permite abrir el panel con sesión. Todo lo demás (tipos, 278 pruebas, build,
rutas protegidas) sí está verificado.

### 6. Confirmar el chequeo nuevo de contacto — **Daniel, 30 segundos**
**Listo cuando:** en Estado del sistema, "Datos de contacto publicados" está en verde.
**Por qué queda pendiente:** es el único de los 21 chequeos que no se pudo probar
contra el sistema real, porque `/api/salud` exige sesión o `CRON_SECRET` y Claude
no maneja secretos. Si estuviera en rojo sería un falso positivo y hay que
corregirlo antes de que el cron de las 8:00 avise en falso — una alarma que no
corresponde es lo que hace que después no se le crea a ninguna.

### 7. Sacar el correo personal de la lista de acceso — **decisión de Daniel**
**Listo cuando:** `PANEL_EMAILS` existe en Vercel, Daniel entra al panel, y
`lib/sesion.ts` ya no necesita el respaldo.
**Por qué no se hizo solo:** ese respaldo es hoy **lo único** que da acceso al
panel, porque `PANEL_EMAILS` no está en Vercel. Cambiarlo a ciegas deja a Daniel
fuera de su propio panel. El orden seguro es: crear la variable, comprobar que
entra, y recién entonces quitar el respaldo. No es información publicada — es la
lista de quién puede entrar.

### 8. Llamar a Tamara Mednik — **Daniel**
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
