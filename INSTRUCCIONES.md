# DLS Control — Instrucciones de Configuración

## Paso 1: Supabase (base de datos)

1. Crear cuenta en supabase.com
2. Crear proyecto nuevo → nombre: `dls-control`
3. Ir a Settings → API y copiar:
   - **Project URL** → reemplazar `SUPABASE_URL_AQUI` en `public/index.html`
   - **anon public key** → reemplazar `SUPABASE_ANON_KEY_AQUI` en `public/index.html`
4. Ir a SQL Editor → pegar el contenido de `schema.sql` → Run

## Paso 2: Anthropic (el bot con IA)

1. Crear cuenta en console.anthropic.com
2. Ir a API Keys → Create Key
3. Copiar la key → guardar para Vercel (Paso 4)

## Paso 3: Variables de entorno en Vercel

En tu proyecto de Vercel → Settings → Environment Variables:

| Variable | Valor |
|---|---|
| SUPABASE_URL | URL de Supabase |
| SUPABASE_SERVICE_KEY | Service Role Key de Supabase (Settings → API) |
| ANTHROPIC_API_KEY | Key de Anthropic |
| WA_ACCESS_TOKEN | Token de WhatsApp (Meta) — Paso 4 |
| WA_PHONE_NUMBER_ID | ID del número de WhatsApp (Meta) |
| WA_VERIFY_TOKEN | Inventar una palabra secreta, ej: `dls2026` |
| IG_ACCESS_TOKEN | Token de Instagram (Meta) |
| IG_VERIFY_TOKEN | Inventar una palabra secreta, ej: `dls-ig-2026` |
| RESEND_API_KEY | Key de resend.com (email gratis) |

## Paso 4: WhatsApp + Instagram (Meta)

1. Ir a developers.facebook.com
2. Crear app → Business → agregar producto "WhatsApp"
3. En la consola de WhatsApp, copiar:
   - Access Token
   - Phone Number ID
4. Configurar webhook: `https://tu-app.vercel.app/api/webhook-whatsapp`
5. Repetir para Instagram DMs

## Paso 5: Deploy en Vercel

1. Subir la carpeta `dls-app/` a GitHub (repositorio privado)
2. En Vercel → Import project → seleccionar el repo
3. Vercel detecta automáticamente la estructura
4. Agregar las variables de entorno del Paso 3
5. Deploy

## Paso 6: Instalar en celular (PWA)

1. Abrir `https://tu-app.vercel.app` en Chrome/Safari del celular
2. En iOS: Safari → compartir → "Agregar a pantalla de inicio"
3. En Android: Chrome → menú → "Instalar app"
4. Aparece en la pantalla de inicio como una app normal
