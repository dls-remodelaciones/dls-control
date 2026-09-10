-- Migracion: el score lleva un decimal.
-- La completitud del §5 es proporcional (3 de 4 datos clave = 7,5 puntos), asi que
-- el motor produce valores como 27.5 y la columna 'int' los rechazaba con
-- 'invalid input syntax for type integer'. Los leads que entraron antes pasaron
-- solo porque sus scores eran redondos.
alter table leads alter column score type numeric(5,1) using score::numeric(5,1);
