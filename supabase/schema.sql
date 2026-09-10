-- ============================================================================
-- DLS Control — esquema Supabase
-- Pegar en: Supabase → SQL Editor → Run
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── LEADS ───────────────────────────────────────────────────────────────────
create table if not exists leads (
  id                    uuid primary key default gen_random_uuid(),
  canal                 text not null,   -- web|cotizador|chatbot|correo|whatsapp|instagram|manual
  nombre                text,
  telefono              text,            -- normalizado E.164 sin '+': 56912345678
  telefono_crudo        text,            -- como lo escribió el cliente
  email                 text,
  tipo_proyecto         text,            -- cocina|bano|quincho|walking_closet|estacionamiento|casa_completa
  comuna                text,
  superficie_m2         numeric,
  rango_presupuesto     text,
  financiamiento        text,            -- propio|credito|por_definir
  plazo                 text,            -- inmediato|1-3_meses|3-6_meses|explorando
  propiedad             text,            -- propia|arriendo|por_comprar
  -- numeric, no int: la completitud es proporcional (3/4 datos = 7,5 puntos),
  -- asi que el score sale con un decimal.
  score                 numeric(5,1) default 0,
  clasificacion         text,            -- A|B|C|D
  desglose              jsonb default '[]'::jsonb,   -- de dónde salió cada punto
  apto_para_llamar      boolean default false,
  estado                text default 'contacto_inicial',
  -- contacto_inicial|cotizador_web|visita_terreno|presupuesto_enviado|cerrado|no_prospero
  etiqueta              text,            -- NUEVO|SEGUIMIENTO|VISITA AGENDADA|PRESUPUESTO ENVIADO
  respondido            boolean default false,
  nota_interna          text,
  motivo_no_prospero    text,
  fotos                 jsonb default '[]'::jsonb,
  proxima_accion        text,
  fecha_proxima_accion  timestamptz,
  fuente_original       text,
  gmail_thread_id       text,            -- para no reimportar el mismo correo
  creado                timestamptz default now(),
  ultima_actividad      timestamptz default now()
);

-- Dedupe: un mismo teléfono o correo no crea dos leads (§4.1 de la especificación).
create unique index if not exists leads_telefono_uniq on leads (telefono)
  where telefono is not null and telefono <> '';
create unique index if not exists leads_email_uniq on leads (lower(email))
  where email is not null and email <> '';
create unique index if not exists leads_gmail_uniq on leads (gmail_thread_id)
  where gmail_thread_id is not null;

create index if not exists leads_orden on leads (clasificacion, score desc, creado desc);
create index if not exists leads_estado on leads (estado);

-- ── MENSAJES ────────────────────────────────────────────────────────────────
create table if not exists mensajes (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid references leads(id) on delete cascade,
  direccion    text not null,            -- entrante|saliente
  canal        text,
  asunto       text,
  cuerpo       text,
  enviado_por  text,                     -- daniel|bot|sistema
  creado       timestamptz default now()
);
create index if not exists mensajes_lead on mensajes (lead_id, creado desc);

-- ── COTIZACIONES ────────────────────────────────────────────────────────────
create table if not exists cotizaciones (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid references leads(id) on delete cascade,
  tipo_proyecto  text,
  superficie_m2  numeric,
  uf_m2          numeric,
  monto_min      numeric,
  monto_max      numeric,
  partidas       jsonb default '[]'::jsonb,
  pdf_url        text,
  enviada        boolean default false,
  enviada_en     timestamptz,
  creado         timestamptz default now()
);

-- ── VISITAS ─────────────────────────────────────────────────────────────────
create table if not exists visitas (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid references leads(id) on delete cascade,
  fecha      timestamptz,
  direccion  text,
  estado     text default 'agendada',    -- agendada|realizada|cancelada
  notas      text,
  gcal_id    text,
  creado     timestamptz default now()
);

-- ── CONFIG ──────────────────────────────────────────────────────────────────
-- Pesos del score, comunas, rangos por tipo, tokens. Editable desde ⚙️ sin tocar código.
create table if not exists config (
  clave       text primary key,
  valor       jsonb not null,
  actualizado timestamptz default now()
);

-- ── SUSCRIPCIONES PUSH ──────────────────────────────────────────────────────
create table if not exists push_subs (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text unique not null,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  creado     timestamptz default now()
);

-- ── ACTIVIDAD ───────────────────────────────────────────────────────────────
-- Para poder deshacer y para saber qué hizo el sistema solo (§7: mover pipeline con deshacer).
create table if not exists actividad (
  id        uuid primary key default gen_random_uuid(),
  lead_id   uuid references leads(id) on delete cascade,
  tipo      text not null,               -- estado|nota|cotizacion|correo|push|score
  antes     jsonb,
  despues   jsonb,
  quien     text default 'daniel',
  creado    timestamptz default now()
);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
-- La app es privada. Sin sesión no se lee ni se escribe nada.
alter table leads        enable row level security;
alter table mensajes     enable row level security;
alter table cotizaciones enable row level security;
alter table visitas      enable row level security;
alter table config       enable row level security;
alter table push_subs    enable row level security;
alter table actividad    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['leads','mensajes','cotizaciones','visitas','config','push_subs','actividad']
  loop
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      'auth_full_' || t, t);
  end loop;
end $$;

-- Los webhooks y los cron entran con la service role key, que salta RLS por diseño.
-- Por eso esa key vive SOLO en variables de entorno de Vercel, nunca en el navegador.

-- ── mantener ultima_actividad al día ────────────────────────────────────────
create or replace function tocar_lead() returns trigger as $$
begin
  new.ultima_actividad = now();
  return new;
end $$ language plpgsql;

drop trigger if exists leads_tocar on leads;
create trigger leads_tocar before update on leads
  for each row execute function tocar_lead();
