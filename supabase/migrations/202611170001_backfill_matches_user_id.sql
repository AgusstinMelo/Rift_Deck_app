-- Partidas viejas guardadas solo con el email (created_by), de antes de que matches
-- tuviera user_id. La app todavía las busca por email cuando no encuentra ninguna por
-- user_id (getUserMatches); con este backfill esa segunda consulta deja de hacer falta y
-- se podrá quitar del cliente.
--
-- Solo toca filas sin user_id y cuyo email coincide con una cuenta existente.

update public.matches as m
set user_id = u.id
from auth.users as u
where m.user_id is null
  and m.created_by is not null
  and lower(u.email) = lower(m.created_by);

-- Control: tiene que dar 0 (o solo partidas de cuentas que ya no existen).
-- select count(*) from public.matches where user_id is null;
