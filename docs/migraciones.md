# Migraciones de Supabase

El historial de la base (`supabase_migrations.schema_migrations`) coincide con
`supabase/migrations/`. Quedó reparado el 16/11/2026:

- Se registraron como aplicadas, con `migration repair`, las migraciones que se habían
  corrido a mano en el SQL Editor (de `202609210001` a `202611170001`).
- Se recuperaron del historial remoto tres que estaban aplicadas pero no tenían archivo en
  el repo: `202608210001`, `202608280001` y `202609020001`.

## Agregar una migración

1. Crear `supabase/migrations/AAAAMMDDNNNN_descripcion.sql` y su rollback en
   `supabase/rollbacks/`, con el mismo nombre.
2. Revisar qué se va a aplicar:
   ```bash
   npx supabase db push --dry-run --remote
   ```
   Tiene que listar solo la migración nueva.
3. Aplicarla:
   ```bash
   npx supabase db push --remote
   ```

`--remote` hace falta: sin él, la CLI apunta a una base local en Docker.

## Para no volver a desincronizarlo

- **No aplicar migraciones a mano en el SQL Editor.** Si alguna vez no queda otra,
  registrala enseguida:
  ```bash
  npx supabase migration repair --status applied --remote <versión>
  ```
- **Cambios de esquema desde el panel de Supabase:** pasarlos a un archivo de migración
  en el repo.
- **Para chequear:** `npx supabase migration list --remote` tiene que mostrar las columnas
  Local y Remote iguales.
