-- 1) Fuera los leads de chequeo que cree probando el formato del webhook.
delete from leads
where email in (
  'chequeo.formato@dlsremodelaciones.cl',
  'chequeo.viejo@dlsremodelaciones.cl',
  'chequeo.sinpreflight@dlsremodelaciones.cl'
);

-- 2) Como quedo la ficha de Tamara: el proyecto principal en las columnas
--    sueltas, y todos los que pidio en 'proyectos'.
select
  nombre,
  clasificacion || ' ' || score            as calificacion,
  tipo_proyecto || ' · ' || comuna || ' · ' || superficie_m2 || ' m2'  as principal,
  jsonb_array_length(proyectos)            as cuantos_proyectos,
  (select string_agg(p->>'tipo' || ' ' || (p->>'m2') || 'm2 ' || (p->>'comuna'), '  |  ')
     from jsonb_array_elements(proyectos) p)  as todos_los_proyectos
from leads
order by score desc;
