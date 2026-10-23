-- Rollback de 202610230001_reschedule_tierlist_cron_6am.sql: vuelve a las 03:30 (hora de España).

select cron.schedule(
  'update-tierlist-daily',
  '30 1,2 * * *',
  $job$
    do $task$
    begin
      if extract(hour from now() at time zone 'Europe/Madrid') = 3 then
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
