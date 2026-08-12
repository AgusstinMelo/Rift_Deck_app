# Patch versioning

Apply the migration and initialize it once with the real production version (it is deliberately not guessed):

```sql
select public.initialize_game_patch('REAL_CURRENT_VERSION');
```

Routine workflow:

```sql
select public.create_patch_from_current('7.3');
select public.validate_patch_by_version('7.3');
select public.activate_patch_by_version('7.3');
select public.activate_patch_by_version('7.2b'); -- rollback
```

Inspect the active patch and draft snapshots:

```sql
select p.* from public.game_state s join public.game_patches p on p.id=s.active_patch_id where s.id=1;

select d.*,p.version from public.champion_patch_stats d join public.game_patches p on p.id=d.patch_id where p.version='7.3';
select d.*,p.version from public.item_patch_data d join public.game_patches p on p.id=d.patch_id where p.version='7.3';
select d.*,p.version from public.rune_patch_data d join public.game_patches p on p.id=d.patch_id where p.version='7.3';
```

Patchable fields are complete JSONB snapshots. Edit only the selected draft, for example:

```sql
update public.champion_patch_stats d
set data=jsonb_set(data,'{armor}','33'::jsonb)
from public.game_patches p
where p.id=d.patch_id and p.version='7.3' and d.champion_id='CHAMPION_ID';
```

The app reads `current_champions`, `current_wr_items`, and `current_runes`. Draft rows are hidden by RLS from app users. Administrative functions are executable only by `postgres` and `service_role`.
