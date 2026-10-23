-- La tierlist automática pasa de las 03:30 a las 06:00 (hora de España): a las
-- 03:30 Tencent todavía no publicó los datos del día anterior.
-- pg_cron trabaja en UTC: se agenda a las 04:00 y 05:00 UTC y solo dispara la
-- que cae a las 06:00 en Europe/Madrid (cubre horario de verano e invierno).
-- cron.schedule con el mismo nombre reemplaza el job existente.

select cron.schedule(
  'update-tierlist-daily',
  '0 4,5 * * *',
  $job$
    do $task$
    begin
      if extract(hour from now() at time zone 'Europe/Madrid') = 6 then
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
