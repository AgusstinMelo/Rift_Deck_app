-- Readable, derived labels for managing snapshots in Supabase Table Editor.
-- IDs remain the source of truth; triggers always overwrite these labels.

alter table public.champion_patch_stats
  add column champion_name text,
  add column patch_version text;
alter table public.item_patch_data
  add column item_name text,
  add column patch_version text;
alter table public.rune_patch_data
  add column rune_name text,
  add column patch_version text;

update public.champion_patch_stats d
set champion_name = c.name, patch_version = p.version
from public.champions c, public.game_patches p
where c.id::text = d.champion_id and p.id = d.patch_id;
update public.item_patch_data d
set item_name = i.name, patch_version = p.version
from public.wr_items i, public.game_patches p
where i.id::text = d.item_id and p.id = d.patch_id;
update public.rune_patch_data d
set rune_name = r.name, patch_version = p.version
from public.runes r, public.game_patches p
where r.id::text = d.rune_id and p.id = d.patch_id;

alter table public.champion_patch_stats alter column champion_name set not null, alter column patch_version set not null;
alter table public.item_patch_data alter column item_name set not null, alter column patch_version set not null;
alter table public.rune_patch_data alter column rune_name set not null, alter column patch_version set not null;

create function public.sync_champion_patch_labels() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 select c.name into new.champion_name from public.champions c where c.id::text=new.champion_id;
 if new.champion_name is null then raise exception 'Unknown champion_id: %',new.champion_id; end if;
 select p.version into new.patch_version from public.game_patches p where p.id=new.patch_id;
 if new.patch_version is null then raise exception 'Unknown patch_id: %',new.patch_id; end if;
 return new;
end $$;
create function public.sync_item_patch_labels() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 select i.name into new.item_name from public.wr_items i where i.id::text=new.item_id;
 if new.item_name is null then raise exception 'Unknown item_id: %',new.item_id; end if;
 select p.version into new.patch_version from public.game_patches p where p.id=new.patch_id;
 if new.patch_version is null then raise exception 'Unknown patch_id: %',new.patch_id; end if;
 return new;
end $$;
create function public.sync_rune_patch_labels() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 select r.name into new.rune_name from public.runes r where r.id::text=new.rune_id;
 if new.rune_name is null then raise exception 'Unknown rune_id: %',new.rune_id; end if;
 select p.version into new.patch_version from public.game_patches p where p.id=new.patch_id;
 if new.patch_version is null then raise exception 'Unknown patch_id: %',new.patch_id; end if;
 return new;
end $$;

create trigger champion_patch_labels_before_write before insert or update on public.champion_patch_stats for each row execute function public.sync_champion_patch_labels();
create trigger item_patch_labels_before_write before insert or update on public.item_patch_data for each row execute function public.sync_item_patch_labels();
create trigger rune_patch_labels_before_write before insert or update on public.rune_patch_data for each row execute function public.sync_rune_patch_labels();

create function public.sync_patch_version_labels() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 update public.champion_patch_stats set patch_version=new.version where patch_id=new.id;
 update public.item_patch_data set patch_version=new.version where patch_id=new.id;
 update public.rune_patch_data set patch_version=new.version where patch_id=new.id;
 return new;
end $$;
create trigger patch_version_labels_after_update after update of version on public.game_patches for each row when(old.version is distinct from new.version) execute function public.sync_patch_version_labels();

create function public.sync_champion_name_labels() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin update public.champion_patch_stats set champion_name=new.name where champion_id=new.id::text; return new; end $$;
create function public.sync_item_name_labels() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin update public.item_patch_data set item_name=new.name where item_id=new.id::text; return new; end $$;
create function public.sync_rune_name_labels() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin update public.rune_patch_data set rune_name=new.name where rune_id=new.id::text; return new; end $$;
create trigger champion_name_labels_after_update after update of name on public.champions for each row when(old.name is distinct from new.name) execute function public.sync_champion_name_labels();
create trigger item_name_labels_after_update after update of name on public.wr_items for each row when(old.name is distinct from new.name) execute function public.sync_item_name_labels();
create trigger rune_name_labels_after_update after update of name on public.runes for each row when(old.name is distinct from new.name) execute function public.sync_rune_name_labels();

create or replace function public.initialize_game_patch(p_version text) returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare v bigint;
begin
 if nullif(btrim(p_version),'') is null then raise exception 'Patch version is required'; end if;
 if exists(select 1 from public.game_state) then raise exception 'Game patching is already initialized'; end if;
 insert into public.game_patches(version,status) values(btrim(p_version),'active') returning id into v;
 insert into public.champion_patch_stats(champion_id,patch_id,data) select id::text,v,to_jsonb(c)-array['id','name','image_url','image_url_card','external_id','original_name'] from public.champions c;
 insert into public.item_patch_data(item_id,patch_id,data) select id::text,v,to_jsonb(i)-array['id','name','image_url'] from public.wr_items i;
 insert into public.rune_patch_data(rune_id,patch_id,data) select id::text,v,to_jsonb(r)-array['id','name','image_url','branch','group'] from public.runes r;
 insert into public.game_state(id,active_patch_id) values(1,v); return v;
end $$;

create or replace function public.create_patch_from_current(p_version text) returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare old_id bigint; new_id bigint;
begin
 if nullif(btrim(p_version),'') is null then raise exception 'Patch version is required'; end if;
 select active_patch_id into old_id from public.game_state where id=1 for update;
 if old_id is null then raise exception 'No active patch is configured'; end if;
 if exists(select 1 from public.game_patches where lower(version)=lower(btrim(p_version))) then raise exception 'Patch version already exists'; end if;
 insert into public.game_patches(version) values(btrim(p_version)) returning id into new_id;
 insert into public.champion_patch_stats(champion_id,patch_id,data) select champion_id,new_id,data from public.champion_patch_stats where patch_id=old_id;
 insert into public.item_patch_data(item_id,patch_id,data) select item_id,new_id,data from public.item_patch_data where patch_id=old_id;
 insert into public.rune_patch_data(rune_id,patch_id,data) select rune_id,new_id,data from public.rune_patch_data where patch_id=old_id;
 return new_id;
end $$;

revoke all on function public.sync_champion_patch_labels(),public.sync_item_patch_labels(),public.sync_rune_patch_labels(),public.sync_patch_version_labels(),public.sync_champion_name_labels(),public.sync_item_name_labels(),public.sync_rune_name_labels() from public,anon,authenticated;
revoke all on function public.initialize_game_patch(text),public.create_patch_from_current(text) from public,anon,authenticated;
grant execute on function public.initialize_game_patch(text),public.create_patch_from_current(text) to postgres,service_role;
