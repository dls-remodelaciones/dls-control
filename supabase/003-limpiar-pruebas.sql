-- Borra SOLO los leads de prueba creados hoy al armar el webhook.
-- Van nombrados uno por uno a proposito: borrar por patron (like '%test%') es
-- como se lleva por delante un cliente real que se apellide Testa.
-- El 'returning' muestra que se borro; el borrado en cascada limpia tambien
-- sus mensajes, cotizaciones y actividad.
delete from leads
where email in (
  'prueba.webhook@dlsremodelaciones.cl',
  'test.canal.web@dlsremodelaciones.cl',
  'test.cotizador@dlsremodelaciones.cl',
  'test.cotizador2@dlsremodelaciones.cl',
  'test.cotizador3@dlsremodelaciones.cl',
  'prueba.sitio.real@dlsremodelaciones.cl'
)
returning nombre, email, comuna, score, clasificacion;
