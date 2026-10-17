-- pgTAP: aislamiento por usuario en objetivos personales y check-ins.
-- Ejecutar en un entorno local: `supabase start` y luego `supabase test db`.
-- Nunca contra la base de producción.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- Usuarios de prueba
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'goals-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'goals-b@test.local');

-- Datos sembrados como superusuario (sin RLS)
insert into public.personal_goals (id, user_id, name, metric, target, unit, period_start, period_end, timezone)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Manual A', 'manual', 10, 'horas',
   now() - interval '2 days', now() + interval '10 days', 'UTC'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Manual B', 'manual', 10, 'horas',
   now() - interval '2 days', now() + interval '10 days', 'UTC');

insert into public.personal_goal_checkins (id, goal_id, user_id, amount, checkin_date) values
  ('cccccccc-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', 2, current_date);

-- Actuar como el usuario A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select ok((select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'personal_goals'),
  'RLS activa en personal_goals');
select ok((select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'personal_goal_checkins'),
  'RLS activa en personal_goal_checkins');

select is((select count(*)::int from public.personal_goals), 1, 'A solo ve su propio objetivo');
select is((select count(*)::int from public.personal_goals where user_id = '22222222-2222-2222-2222-222222222222'),
  0, 'A no puede leer objetivos de B');
select is((select count(*)::int from public.personal_goal_checkins), 0, 'A no puede leer check-ins de B');

-- Modificar / borrar lo ajeno no afecta filas
update public.personal_goals set name = 'hackeado' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
delete from public.personal_goals where id = 'bbbbbbbb-0000-0000-0000-000000000001';
update public.personal_goal_checkins set amount = 99 where id = 'cccccccc-0000-0000-0000-00000000000b';
delete from public.personal_goal_checkins where id = 'cccccccc-0000-0000-0000-00000000000b';

-- Insertar un objetivo a nombre de otro usuario
select throws_ok(
  $$insert into public.personal_goals (user_id, name, metric, target, unit, period_start, period_end, timezone)
    values ('22222222-2222-2222-2222-222222222222', 'x', 'manual', 1, 'u', now(), now() + interval '1 day', 'UTC')$$,
  '42501', null, 'A no puede crear objetivos a nombre de B');

-- Asociar un check-in a un objetivo ajeno (con su propio user_id)
select throws_ok(
  $$insert into public.personal_goal_checkins (goal_id, user_id, amount, checkin_date)
    values ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1, current_date)$$,
  null, null, 'A no puede asociar un check-in a un objetivo de B');

-- Asociar un check-in a un objetivo ajeno haciéndose pasar por B
select throws_ok(
  $$insert into public.personal_goal_checkins (goal_id, user_id, amount, checkin_date)
    values ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 1, current_date)$$,
  null, null, 'A no puede crear check-ins a nombre de B');

-- Operaciones propias permitidas
select lives_ok(
  $$insert into public.personal_goal_checkins (goal_id, amount, checkin_date)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 3, current_date)$$,
  'A puede registrar check-ins en su objetivo');

select throws_ok(
  $$update public.personal_goals set metric = 'winrate' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '22023', null, 'La métrica no se puede editar');

select throws_ok(
  $$update public.personal_goals set timezone = 'Mars/Olympus' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '22023', null, 'Rechaza zonas horarias inválidas');

-- Verificar como superusuario que los datos de B siguen intactos
reset role;
select is((select name from public.personal_goals where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'Manual B', 'El objetivo de B no fue modificado ni borrado');
select is((select amount from public.personal_goal_checkins where id = 'cccccccc-0000-0000-0000-00000000000b'),
  2.00::numeric, 'El check-in de B no fue modificado ni borrado');

-- Usuario anónimo
set local role anon;
select throws_ok($$select count(*) from public.personal_goals$$, '42501', null, 'anon no tiene acceso');

select * from finish();
rollback;
