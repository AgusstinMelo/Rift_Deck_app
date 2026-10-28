import ChampionLibrary from '@/components/library/ChampionLibrary';
import PublicLibraryLayout from '@/components/public/PublicLibraryLayout';
import Seo from '@/components/Seo';
import { CHAMPIONS_SEO } from '@/seo/publicSeo';
import { useT } from '@/lib/LocaleContext';

export default function PublicChampions({ initialChampions, initialTierlist }) {
  const t = useT();
  return (
    <PublicLibraryLayout activeTab="champions" srTitle={t('library.campeonesDeWildRift')}>
      <Seo {...CHAMPIONS_SEO} indexable />
      <ChampionLibrary
        initialChampions={initialChampions}
        initialTierlist={initialTierlist}
        publicBasePath="/campeones"
      />
    </PublicLibraryLayout>
  );
}
