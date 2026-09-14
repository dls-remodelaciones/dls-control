-- 007 — Solo los correos del panel pueden leer y escribir datos.
--
-- Por qué: las políticas originales daban acceso total a CUALQUIER usuario con
-- sesión (`to authenticated using (true)`), y Supabase tenía los registros
-- abiertos. Cualquiera que pidiera un código de ingreso con su correo quedaba
-- con sesión y podía leer todos los leads (nombres, teléfonos, conversaciones)
-- directo desde la API, sin pasar por el panel. Encontrado el 13-sep-2026; en
-- ese momento el único usuario era Daniel, no hubo acceso de terceros.
--
-- Qué hace: reemplaza esas políticas por unas que exigen que el correo de la
-- sesión esté en `es_del_panel()`. Los webhooks y crons no cambian: entran con
-- la service role key, que salta RLS.
--
-- Para sumar a alguien al panel: agregar su correo acá Y en PANEL_EMAILS (Vercel).

create or replace function es_del_panel() returns boolean
language sql stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'dls.lehmann@gmail.com'
  );
$$;

do $$
declare t text;
begin
  foreach t in array array['leads','mensajes','cotizaciones','visitas','config','push_subs','actividad']
  loop
    execute format('drop policy if exists %I on %I', 'auth_full_' || t, t);
    execute format('drop policy if exists %I on %I', 'panel_' || t, t);
    execute format(
      'create policy %I on %I for all to authenticated using (es_del_panel()) with check (es_del_panel())',
      'panel_' || t, t);
  end loop;
end $$;

-- Verificación: debe listar 7 políticas "panel_*" y ninguna "auth_full_*".
select tablename, policyname from pg_policies where schemaname = 'public' order by tablename;
