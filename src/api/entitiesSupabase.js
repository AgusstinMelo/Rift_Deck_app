import { SupabaseEntityFactory } from '@/api/supabaseApi';

export const Champion = SupabaseEntityFactory('current_champions');
const WRItemEntity = SupabaseEntityFactory('current_wr_items');

export const WRItem = {
  ...WRItemEntity,
  list: (optionsOrOrder, limit) => WRItemEntity.filter({ active: true }, optionsOrOrder, limit),
  filter: (filters = {}, optionsOrOrder, limit) =>
    WRItemEntity.filter({ active: true, ...filters }, optionsOrOrder, limit),
  listAll: WRItemEntity.list,
};
export const Match = SupabaseEntityFactory('matches');
export const Build = SupabaseEntityFactory('builds');
export const TierlistEntry = SupabaseEntityFactory('tierlist_entries');
export const TierlistExecution = SupabaseEntityFactory('tierlist_executions');
export const TierlistConfig = SupabaseEntityFactory('tierlist_configs');
export const Rune = SupabaseEntityFactory('current_runes');
export const Spell = SupabaseEntityFactory('spells');
export const Profile = SupabaseEntityFactory('profiles');
export const BugReport = SupabaseEntityFactory('bug_reports');
export const Membership = SupabaseEntityFactory('memberships');
