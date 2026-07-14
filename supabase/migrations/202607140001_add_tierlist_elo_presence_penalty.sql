alter table public.tierlist_configs
  add column if not exists apply_elo_presence_penalty boolean not null default true;

comment on column public.tierlist_configs.apply_elo_presence_penalty is
  'Whether tierlist calculation penalizes champions that are absent from some analyzed elos.';
