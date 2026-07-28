alter table public.matches
  add column if not exists client_request_id text;

create unique index if not exists matches_user_client_request_id_uidx
  on public.matches (user_id, client_request_id);
