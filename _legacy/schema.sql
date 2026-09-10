-- ============================================================
-- DLS Control — Esquema Supabase
-- Pegar en: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Extensión para UUIDs
create extension if not exists "uuid-ossp";

-- ── LEADS ──────────────────────────────────────────────────
create table leads (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz default now(),
  name        text not null,
  phone       text,          -- WhatsApp / teléfono
  email       text,          -- Email
  ig_handle   text,          -- Instagram @handle
  channel     text not null check (channel in ('wa','em','ig')),
  status      text default 'nuevo' check (status in ('nuevo','seguimiento','visita','presupuesto','cerrado')),
  pipe_step   int  default 0 check (pipe_step between 0 and 4),
  tipo        text,          -- Cocina, Baño, Quincho, etc.
  m2          text,
  zona        text,
  presupuesto text,
  unread      int  default 0,
  last_msg_at timestamptz default now(),
  bot_active  boolean default true   -- si el bot responde automáticamente
);

-- ── MENSAJES ───────────────────────────────────────────────
create table messages (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz default now(),
  lead_id     uuid references leads(id) on delete cascade,
  channel     text not null check (channel in ('wa','em','ig')),
  direction   text not null check (direction in ('in','out','bot')),
  text        text not null,
  read        boolean default false,
  meta        jsonb          -- datos extra del canal (message_id, etc.)
);

-- ── USUARIOS DEL PANEL ─────────────────────────────────────
create table panel_users (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz default now(),
  email       text unique not null,
  name        text,
  role        text default 'agent' check (role in ('admin','agent'))
);

-- ── CONFIGURACIÓN DEL BOT ─────────────────────────────────
create table bot_config (
  id          uuid primary key default uuid_generate_v4(),
  key         text unique not null,
  value       text,
  updated_at  timestamptz default now()
);

-- Datos iniciales del bot
insert into bot_config (key, value) values
  ('company_name',   'DLS Remodelaciones'),
  ('phone_wa',       '+56 9 XXXX XXXX'),
  ('bot_enabled',    'true'),
  ('escalate_keywords', 'precio final,contrato,garantía,problema,reclamo'),
  ('price_cocina',   '$15.000.000 – $30.000.000'),
  ('price_bano',     '$5.000.000 – $7.000.000'),
  ('price_quincho',  '$25.000.000 – $45.000.000'),
  ('price_estac',    '$10.000.000 – $16.000.000'),
  ('price_depto',    '1.000 – 3.000 UF');

-- ── ÍNDICES ────────────────────────────────────────────────
create index idx_messages_lead_id  on messages(lead_id);
create index idx_messages_created  on messages(created_at desc);
create index idx_leads_last_msg    on leads(last_msg_at desc);
create index idx_leads_status      on leads(status);
create index idx_leads_channel     on leads(channel);

-- ── ROW LEVEL SECURITY ────────────────────────────────────
alter table leads        enable row level security;
alter table messages     enable row level security;
alter table panel_users  enable row level security;
alter table bot_config   enable row level security;

-- Política simple: solo usuarios autenticados leen/escriben
create policy "Authenticated users" on leads        for all using (auth.role() = 'authenticated');
create policy "Authenticated users" on messages     for all using (auth.role() = 'authenticated');
create policy "Authenticated users" on panel_users  for all using (auth.role() = 'authenticated');
create policy "Authenticated users" on bot_config   for all using (auth.role() = 'authenticated');

-- ── REAL-TIME ─────────────────────────────────────────────
-- Habilitar real-time en estas tablas (en Supabase Dashboard → Database → Replication)
-- También se puede hacer aquí:
alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table messages;
