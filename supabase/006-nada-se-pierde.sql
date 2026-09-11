-- 006 — Nada se pierde en la entrada
--
-- Regla de negocio fijada por Daniel el 2026-09-11:
--   "Todo lead que entre tiene que ser reportado. Me da lo mismo si compra cien
--    mil pesos o cien mil millones. Que lo categorice como quiera, pero sí o sí
--    tiene que aparecer."
--
-- Hasta hoy el webhook rechazaba con 422 a cualquiera que no dejara teléfono ni
-- correo, y el chatbot exigía LOS DOS. Una persona que respondía nueve preguntas
-- y no quería dar el celular desaparecía completa: ni el nombre, ni los m², ni
-- la comuna quedaban registrados.
--
-- Desde ahora entran igual, marcados, y sin contaminar la lista de "llamar hoy"
-- (esa ya filtra por apto_para_llamar, que exige teléfono válido).

-- 1. Identificador de la visita.
--    Sin teléfono ni correo no hay con qué deduplicar: cada mensaje parcial del
--    mismo visitante crearía una fila nueva. Este id lo genera el navegador una
--    vez por visita y viaja en cada envío, así los avances de una misma persona
--    caen siempre en la misma ficha.
alter table leads add column if not exists sesion_id text;

create unique index if not exists leads_sesion_id_idx
  on leads (sesion_id)
  where sesion_id is not null and sesion_id <> '';

-- 2. Para poder mirar rápido cuánta gente llega y se va sin dejar datos.
create index if not exists leads_sin_contacto_idx
  on leads (creado desc)
  where (telefono is null or telefono = '') and (email is null or email = '');

-- 3. La etiqueta ya existía como texto libre; dejamos anotado el valor nuevo.
comment on column leads.etiqueta is
  'NUEVO | SIN CONTACTO | SEGUIMIENTO | VISITA AGENDADA | PRESUPUESTO ENVIADO';

comment on column leads.sesion_id is
  'Id aleatorio de la visita del navegador. Permite juntar los envíos parciales '
  'de una misma persona cuando todavía no dejó teléfono ni correo.';

-- 4. Comprobación: cuántos hay de cada tipo.
select
  count(*)                                                          as total,
  count(*) filter (where coalesce(telefono,'') <> ''
                      or coalesce(email,'') <> '')                  as contactables,
  count(*) filter (where coalesce(telefono,'') =  ''
                     and coalesce(email,'')    =  '')                as sin_contacto,
  count(*) filter (where apto_para_llamar)                          as para_llamar_hoy
from leads;
