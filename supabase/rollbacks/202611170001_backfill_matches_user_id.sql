-- Rollback de 202611170001_backfill_matches_user_id.sql
-- No hace falta deshacerlo: completar user_id no cambia qué partidas ve cada usuario
-- (son las mismas que ya encontraba por email). No hay forma segura de saber qué filas
-- estaban vacías antes, así que este rollback no hace nada.
select 1;
