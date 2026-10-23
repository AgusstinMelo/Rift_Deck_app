import ChampionLibrary from '@/components/library/ChampionLibrary';
import PublicLibraryLayout from '@/components/public/PublicLibraryLayout';
import Seo from '@/components/Seo';
import { CHAMPIONS_SEO } from '@/seo/publicSeo';

export default function PublicChampions({ initialChampions, initialTierlist }) {
  return (
    <PublicLibraryLayout activeTab="champions" srTitle="campeones de Wild Rift">
      <Seo {...CHAMPIONS_SEO} indexable />
      <ChampionLibrary
        initialChampions={initialChampions}
        initialTierlist={initialTierlist}
        publicBasePath="/campeones"
      />
    </PublicLibraryLayout>
  );
}
