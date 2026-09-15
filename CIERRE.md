# Cierre de DLS Control — qué falta para 10/10

Este documento existe porque el trabajo se sentía interminable: muchos días de
prueba y error sin una lista clara de qué es "terminado". Acá está esa lista.

**Cómo se usa.** Cada punto tiene un criterio de listo que se puede verificar, y
un dueño. Nada se marca hecho porque "debería funcionar": se marca cuando el
criterio se cumple mirando el sistema real. Mientras quede un punto abierto, el
trabajo no está cerrado.

**Lo que cambió el 15-sep:** el trámite del que dependía todo —la verificación del
negocio— **está aprobado**. Durante semanas fue el cuello de botella; ya no lo es.
Ahora el punto más avanzado de la lista es enviar la solicitud de revisión, y el
más urgente es el botón de WhatsApp del perfil de Instagram, que sigue desviando
clientes a un privado que no queda registrado.

Última revisión: 2026-09-15.

**Versión para el celular:** https://claude.ai/code/artifact/30ddb153-fd9b-4bdd-949a-faa89c0c0df1
(las casillas que se marcan ahí quedan guardadas y se pueden leer desde una sesión nueva).

---

## El cuello de botella — ✅ destrabado el 2026-09-15

Durante semanas todo dependió de **la verificación del portafolio empresarial ante
Meta**, que solo podía hacer Daniel porque son datos legales. Se envió el 14-sep a
las 21:00 con RUT, razón social y dirección del SII, y **Meta la aprobó antes de las
07:13 del 15** — menos de doce horas, no los dos días laborables que anunció.

> Verificado en pantalla: Business Suite → EXPERTOS EN REMODELACIONES → Cuentas de
> WhatsApp → "Verificación de la empresa: **Verificado**", "Estado de la cuenta:
> **Aprobada**".

Lo que colgaba de ella, ahora en marcha:

1. **Enviar** la solicitud de revisión de la aplicación: ya se puede. El formulario
   está completo y la verificación deja de bloquear el botón.
2. Que Meta apruebe `pages_messaging`.
3. Que un cliente cualquiera que escriba a la página de Facebook **genere un
   lead** (hoy solo generan lead quienes tengan un rol en la app).
4. Que se le pueda **responder** ese Messenger desde el panel.
5. Que tenga sentido generar `FB_PAGE_ACCESS_TOKEN` (antes de eso no sirve).

Instagram ya demostró que, una vez destrabado el permiso, **todo lo demás ya está
construido y funciona**: el mismo código que responde Instagram responde
Messenger. No falta programación. Falta el trámite.

> El trámite ya no es la excusa. Lo que queda de Messenger es enviar la solicitud y
> esperar a que Meta revise el permiso.

---

## Estado por canal

Criterio de 10/10 para un canal: **entra el lead, avisa, se puede responder desde
el panel, y la revisión diaria se da cuenta si se cae.**

| Canal | Entra | Avisa | Responde | Vigilado | Se distingue | Estado |
|---|---|---|---|---|---|---|
| Sitio y cotizador | ✅ | ✅ | n/a | ✅ | ✅ | **10/10** |
| WhatsApp | ✅ | ✅ | ✅ | ✅ | ✅ | **10/10** |
| Instagram | ✅ | ✅ | ✅ | ✅ | ✅ | **9/10** — hay un camino correcto (el enlace wa.me), pero el chip viejo sigue desviando al privado (punto 3) |
| Correo | ✅ | ✅ | n/a | ✅ | ✅ | **10/10** |
| Messenger | ⚠️ solo roles | ✅ | ⚠️ bloqueado | ✅ | ✅ | **esperando el permiso** — la verificación ya no lo bloquea |

Messenger tiene el código completo y probado. Lo único que le falta es el permiso, y
la verificación que lo tenía detenido está aprobada desde el 15-sep.

"Se distingue" se agregó el 15-sep: el canal ahora se ve en la tarjeta, la lista
va agrupada por canal y el aviso al celular dice por dónde entró. Antes el dato
se guardaba y no se mostraba en ninguna parte, así que los cinco canales caían en
un buzón donde todo se veía igual.

---

## Lo que queda abierto

### 1. Verificar el negocio ante Meta — ✅ **APROBADO el 2026-09-15**
**Cómo se verificó:** Meta Business Suite → portafolio EXPERTOS EN REMODELACIONES →
Cuentas de WhatsApp → DLS Arquitectura y Construcción SpA muestra **Verificación de la
empresa: Verificado** y **Estado de la cuenta: Aprobada**. Visto en pantalla, no supuesto.
**Tardó menos de 12 horas**, no los dos días laborables que anunció Meta: se envió el 14 a
las 21:00 y ya estaba aprobado el 15 a las 07:13.
**Lo que esto destraba:** los puntos 2, 4 y la cadena de Messenger completa.
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
**Ya no está bloqueado por la verificación** (aprobada el 15-sep). Queda una sola
condición: que Meta haya registrado la llamada de prueba a la API, que tarda hasta 24 h en
aparecer y después vale 30 días. La llamada se hizo el 14-sep cerca de las 16:00 UTC, así
que debería estar registrada. **Esto pasó a ser el punto más avanzado de la lista.**
**Cuidado:** es irreversible — enviada, no se puede editar ni cancelar. No se
envía sin que Daniel vea el formulario completo y lo apruebe.

### 3. El botón de WhatsApp del perfil de Instagram — **Daniel**
**Listo cuando:** al apretarlo en el celular se abre un chat con +56 9 5638 1974.
**Ya resuelto el 14-sep:** el **correo** del perfil (`contacto@dlsremodelaciones.cl`,
antes un Gmail personal), el **teléfono de contacto** (+56 9 5638 1974) y la casilla
"Mostrar información de contacto", que estaba apagada — sin ella el perfil no
mostraba ningún dato. Verificado en el panel "Contacto" del perfil móvil.
**Paliativo ya puesto (15-sep):** se agregó un **enlace** en el perfil,
`https://wa.me/56956381974` titulado "WhatsApp". Ese sí manda al número de la
empresa y sus mensajes **entran al panel** por la Cloud API. Verificado por Daniel.
Así que hoy el perfil tiene dos caminos a WhatsApp: el enlace (correcto) y el chip
viejo (al privado).

**Lo que sigue abierto:** el chip blanco con ícono de WhatsApp, en la fila de
perfiles vinculados, junto al de Facebook. **Siete lugares descartados uno por uno:**
1. "Botones de acción" → "Ninguno activo".
2. "Opciones de contacto" → correo y teléfono, ya correctos.
3. El campo "Número de WhatsApp" de Cuenta profesional → se **desvinculó** por
   completo y el chip siguió ahí. Ese campo es para anuncios, no para el perfil.
4. Activos conectados de la cuenta de Instagram → solo la página de Facebook.
5. Activos conectados de la página de Facebook → solo la cuenta de Instagram.
6. Enlaces del perfil → solo el sitio y el wa.me nuevo.
7. Caché de la app → se probó seis horas después, sin cambio.

**Lo único que queda por abrir:** el chip **"+ Agregar"** al final de esa misma
fila, en el perfil propio (no en la vista de visitante, donde no aparece). Esa fila
son los perfiles vinculados y se administra desde ahí.

**Dato que puede explicarlo:** hay **dos cuentas de Meta** distintas —
`d_santos91@hotmail.com` (con un Facebook y un Instagram) y `dls.lehmann@gmail.com`
(con el Instagram de D.L.S)— y **tres portafolios** de negocio. La vinculación de
WhatsApp puede vivir del lado de la cuenta de Hotmail, que no se revisó en ningún
momento.

**Límite real:** ese chip **solo existe dentro de la app móvil**. Se leyó el HTML
completo del perfil público (828 mil caracteres) y no hay ningún campo de contacto
del negocio; Instagram lo dice en su propia letra chica. No está en la web, ni en la
API, ni en Business Suite. Ejecutarlo es de Daniel por fuerza.
**Por qué importa de verdad:** quien aprieta ese botón escribe a un privado y ese
mensaje **no entra al panel**: no queda registrado como lead ni avisa nada.

### 4. `FB_PAGE_ACCESS_TOKEN` — **Daniel, después del punto 2**
**Listo cuando:** existe en Vercel y la revisión diaria dice "identificador vivo".
**No hacerlo antes:** el token se genera en un minuto, pero sin `pages_messaging`
aprobado solo deja escribirle a quien tenga un rol en la app. Guardarlo antes crea la
ilusión de que Messenger quedó listo. El punto 1 ya no lo bloquea; ahora depende de
que se envíe la solicitud (punto 2) y Meta la apruebe.

### 5. Verificar en pantalla lo último — **Daniel**
**Listo cuando:** en el panel se ve la conversación de Instagram dentro de la
ficha, y una foto enviada por DM aparece guardada.
**Por qué queda pendiente:** son cambios de interfaz y el entorno de Claude no
permite abrir el panel con sesión. Todo lo demás (tipos, 359 pruebas, build,
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

### 8. Leads de prueba contados como clientes — ✅ **resuelto el 2026-09-15**
**Cómo quedó:** desde la ficha se marca un lead como "prueba del sistema". Al marcarlo
deja de contar en las tres cifras, en las listas de Hoy, en el aviso de las 8:00 y en el
resumen de los lunes; sigue en la Bandeja con su insignia y se puede revertir.
**Por qué importaba más de lo que parecía:** un lead de prueba con 87 puntos tapa a un
cliente real de 60, porque la lista se ordena por puntaje. Y un aviso que pide una llamada
imposible todas las mañanas es el que enseña a ignorar los avisos.
**Lo que falta:** marcar los leads de prueba que ya existen. Eso es un toque por lead, y es
de Daniel: Claude no marca ni borra datos de leads por iniciativa propia.
**Decisión de diseño:** la marca es explícita, **nunca por nombre**. Detectar "prueba" o
"test" en el nombre escondería el lead de una clienta apellidada Testa sin que nada falle.

### 9. El primer cliente real de punta a punta — **cuando llegue**
**Listo cuando:** un cliente que no sea una prueba entra por algún canal, queda
clasificado, recibe respuesta y avanza de estado en el panel.
**Por qué está acá:** los leads que hay hoy en la base son **pruebas del
sistema**, no clientes (Daniel lo confirmó el 15-sep). Los nombres "Daniel De
Los Santos" y "Tamara Mednik", y todo lo que empiece con "Prueba", "Chequeo" o
"Verificacion", son de prueba. Están las piezas verificadas una por una, pero el
recorrido completo con un cliente de verdad todavía no ocurrió, y esa es la
última prueba que falta. No depende de código.

**Consecuencia molesta, y abierta:** el aviso diario de "leads A sin llamar"
insiste cada mañana con esos leads de prueba, y el resumen semanal los cuenta
como negocio. Lo correcto es poder marcar un lead como prueba y que los avisos y
los contadores lo ignoren — no una lista de nombres escrita en el código, que se
rompe con el próximo nombre de prueba que a nadie se le avise.

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
