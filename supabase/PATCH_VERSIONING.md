# Gestión de parches

Guía rápida para preparar, validar, publicar y revertir parches de Wild Rift desde el SQL Editor y el Table Editor de Supabase.

Flujo habitual:

```text
1. Crear nuevo parche
2. Verificar que fue creado como draft
3. Editar sus datos desde Supabase
4. Validar
5. Activar
6. Confirmar cuál quedó activo
```

> [!IMPORTANT]
> - `initialize_game_patch()` se usa únicamente durante la inicialización original del sistema. **No debe ejecutarse para cada parche.**
> - No ejecutar `create_patch_from_current()` con una versión que ya exista.
> - Crear siempre el siguiente parche desde el parche actualmente activo.
> - Editar únicamente el parche en estado `draft`; nunca el parche activo.
> - Validar antes de activar.
> - Activar únicamente cuando el parche ya esté oficialmente disponible en Wild Rift.
> - Si surge un problema, hacer rollback activando la versión anterior.
> - Los IDs son la fuente de verdad. Los nombres y `patch_version` son campos auxiliares para facilitar la administración.

## 1. Crear un nuevo parche

Reemplazá `7.2d` por la versión real:

```sql
select public.create_patch_from_current('7.2d');
```

Este comando copia los snapshots del parche actualmente activo y crea `7.2d` como `draft`. Producción continúa utilizando el parche anterior hasta que se active el nuevo.

## 2. Verificar que fue creado

```sql
select
  version,
  status,
  created_at
from public.game_patches
order by created_at desc;
```

Resultado esperado:

```text
7.2d | draft
7.2c | active
```

## 3. Editar el nuevo parche

Desde Supabase Table Editor, modificá únicamente los registros cuyo:

```text
patch_version = 7.2d
```

Tablas a revisar:

- `champion_patch_stats`
- `item_patch_data`
- `rune_patch_data`

> [!WARNING]
> No modifiques el parche actualmente activo mientras preparás el siguiente.

Los campos `champion_name`, `item_name`, `rune_name` y `patch_version` ayudan a identificar cada registro. Los IDs continúan siendo la fuente de verdad.

## 4. Validar antes de publicar

```sql
select public.validate_patch_by_version('7.2d');
```

La respuesta incluye `valid` y una lista de `errors`. No actives el parche si `valid` es `false` o si la validación devuelve errores; corregilos y volvé a ejecutar el comando.

## 5. Activar el parche

Cuando el parche ya esté oficialmente publicado en Wild Rift:

```sql
select public.activate_patch_by_version('7.2d');
```

La operación cambia atómicamente el parche utilizado por producción y archiva el que estaba activo.

## 6. Confirmar el parche activo

```sql
select
  p.version,
  p.status
from public.game_state s
join public.game_patches p
  on p.id = s.active_patch_id
where s.id = 1;
```

## Rollback

Si se detecta un error después de publicar, activá nuevamente la versión anterior:

```sql
select public.activate_patch_by_version('7.2c');
```

Después, ejecutá la consulta de confirmación para comprobar que el rollback quedó activo.

## Cheat Sheet

Reemplazá las versiones de ejemplo antes de ejecutar:

```sql
-- CREAR
select public.create_patch_from_current('7.2d');

-- VERIFICAR
select version, status, created_at
from public.game_patches
order by created_at desc;

-- VALIDAR
select public.validate_patch_by_version('7.2d');

-- ACTIVAR
select public.activate_patch_by_version('7.2d');

-- VER ACTIVO
select
  p.version,
  p.status
from public.game_state s
join public.game_patches p
  on p.id = s.active_patch_id
where s.id = 1;

-- ROLLBACK
select public.activate_patch_by_version('7.2c');
```
