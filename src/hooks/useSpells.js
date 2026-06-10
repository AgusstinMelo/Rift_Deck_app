import { useQuery } from '@tanstack/react-query';
import { Spell } from '@/api/entitiesSupabase';

export function useSpells() {
  return useQuery({
    queryKey: ['spells'],
    queryFn: () => Spell.list('name'),
  });
}
