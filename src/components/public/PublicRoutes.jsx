import { Route, Routes } from 'react-router-dom';
import Landing from '@/pages/Landing';
import PublicChampions from '@/pages/PublicChampions';
import PublicChampionDetail from '@/pages/PublicChampionDetail';

export default function PublicRoutes({ publicData }) {
  const champions = publicData?.champions;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/campeones" element={<PublicChampions initialChampions={champions} />} />
      <Route path="/campeones/:slug" element={<PublicChampionDetail initialChampions={champions} initialExecutions={publicData?.executions} initialTierlist={publicData?.tierlist} />} />
    </Routes>
  );
}
