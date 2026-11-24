-- Suscripciones por Google Play (app de Android) y conservación de los datos de facturación
-- al eliminar una cuenta.

-- 1. Cada plan se vende en Google Play como una suscripción propia (un solo plan base cada
--    una: la Digital Goods API de la TWA trabaja por producto).
alter table public.membership_plans add column if not exists google_play_product_id text;

update public.membership_plans set google_play_product_id = v.product_id, updated_at = now()
from (values
  ('premium', 'premium_monthly'),
  ('premium_quarterly', 'premium_quarterly'),
  ('premium_annual', 'premium_annual')
) as v(code, product_id)
where membership_plans.code = v.code and membership_plans.google_play_product_id is null;

create unique index if not exists membership_plans_google_play_product_idx
  on public.membership_plans (google_play_product_id) where google_play_product_id is not null;

-- 2. En Google Play, provider_subscription_id guarda el purchase token: un token es de una
--    sola cuenta de Rift Deck.
create unique index if not exists memberships_google_play_token_idx
  on public.memberships (provider_subscription_id) where provider = 'google_play';

-- Si memberships tiene un check sobre provider (hoy no), se amplía con google_play.
do $$
declare
  r record;
begin
  for r in
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint
    where conrelid = 'public.memberships'::regclass and contype = 'c'
  loop
    if r.def ilike '%provider%' and r.def not ilike '%google_play%' then
      execute format('alter table public.memberships drop constraint %I', r.conname);
      alter table public.memberships add constraint memberships_provider_check check (provider in (
        'mercadopago', 'paypal', 'google_play', 'manual', 'trial'
      )) not valid;
    end if;
  end loop;
end;
$$;

-- 3. Al eliminar una cuenta, las membresías pagas se conservan anonimizadas (obligación
--    fiscal, hasta 6 años): el borrado del usuario ya no las arrastra (antes: ON DELETE CASCADE).
--    payment_events ya usaba ON DELETE SET NULL.
alter table public.memberships alter column user_id drop not null;
alter table public.memberships drop constraint if exists memberships_user_id_fkey;
alter table public.memberships add constraint memberships_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
