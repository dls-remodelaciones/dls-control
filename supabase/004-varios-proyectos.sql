-- Una persona puede querer varias cosas.
-- Hasta ahora el dedupe pisaba el proyecto anterior con el nuevo: Tamara Mednik
-- pidio cocina, quincho y casa completa, y su ficha mostraba solo la casa.
-- Los datos no se perdian (quedaban en 'mensajes') pero la tarjeta que Daniel
-- mira para decidir a quien llamar mostraba media historia.
alter table leads add column if not exists proyectos jsonb not null default '[]'::jsonb;

comment on column leads.proyectos is
  'Todos los proyectos que pidio esta persona: [{tipo, tipo_label, comuna, m2, presupuesto, fecha}]. '
  'Las columnas sueltas (tipo_proyecto, comuna, ...) guardan el proyecto PRINCIPAL, '
  'que es el de mayor presupuesto — es el que decide el score y el que se menciona al llamar.';
