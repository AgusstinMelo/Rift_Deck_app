import { Route, Routes } from 'react-router-dom';
import Landing from '@/pages/Landing';
import PublicChampions from '@/pages/PublicChampions';
import PublicChampionDetail from '@/pages/PublicChampionDetail';
import PublicItems from '@/pages/PublicItems';
import PublicRunes from '@/pages/PublicRunes';

export default function PublicRoutes({ publicData }) {
  const champions = publicData?.champions;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/campeones" element={<PublicChampions initialChampions={champions} initialExecutions={publicData?.executions} initialTierlist={publicData?.tierlist} />} />
      <Route path="/campeones/:slug" element={<PublicChampionDetail initialChampions={champions} initialExecutions={publicData?.executions} initialTierlist={publicData?.tierlist} />} />
      <Route path="/objetos" element={<PublicItems initialItems={publicData?.items} initialChampions={champions} />} />
      <Route path="/objetos/:slug" element={<PublicItems initialItems={publicData?.items} initialChampions={champions} />} />
      <Route path="/runas" element={<PublicRunes initialRunes={publicData?.runes} />} />
      <Route path="/runas/:slug" element={<PublicRunes initialRunes={publicData?.runes} />} />
    </Routes>
  );
}
