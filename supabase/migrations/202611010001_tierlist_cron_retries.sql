-- La tierlist automática suma dos reintentos, a las 08:00 y a las 12:00 (hora de
-- España): el 31/10 Tencent no respondió a las 06:00 y se perdió el día, porque
-- la API solo expone el último día publicado.
-- Si ese día ya se procesó, la función devuelve "skipped" sin escribir nada.
-- pg_cron trabaja en UTC: se agenda en las horas UTC de verano e invierno y solo
-- dispara las que caen a las 06, 08 o 12 en Europe/Madrid.
-- cron.schedule con el mismo nombre reemplaza el job existente.

select cron.schedule(
  'update-tierlist-daily',
  '0 4,5,6,7,10,11 * * *',
  $job$
    do $task$
    begin
      if extract(hour from now() at time zone 'Europe/Madrid') in (6, 8, 12) then
        perform net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'tierlist_function_url'),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'tierlist_cron_secret')
          ),
          body := jsonb_build_object('trigger', 'cron'),
          timeout_milliseconds := 150000
        );
      end if;
    end
    $task$;
  $job$
);
