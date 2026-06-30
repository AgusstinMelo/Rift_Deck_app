alter table public.matches
  add column if not exists type text;

update public.matches
set type = 'ranked'
where type is null;

alter table public.matches
  alter column type set default 'ranked',
  alter column type set not null;

alter table public.matches
  drop constraint if exists matches_type_check;

alter table public.matches
  add constraint matches_type_check
  check (type in ('ranked', 'legendary_ranked', 'casual'));

create index if not exists matches_user_id_type_idx
  on public.matches (user_id, type);
