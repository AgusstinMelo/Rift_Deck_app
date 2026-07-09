alter table public.wr_items
  add column if not exists active boolean;

update public.wr_items
set active = true
where active is null;

alter table public.wr_items
  alter column active set default true,
  alter column active set not null;

create index if not exists wr_items_active_idx
  on public.wr_items (active);
