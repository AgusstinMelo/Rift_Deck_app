-- Rollback de 202611010001_tierlist_cron_retries.sql: vuelve a un solo intento a las 06:00 (hora de España).

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
