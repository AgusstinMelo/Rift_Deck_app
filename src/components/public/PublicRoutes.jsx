import { Route, Routes, useLocation } from 'react-router-dom';
import AnimatedBackground from '@/components/AnimatedBackground';
import Home from '@/pages/Home';
import PublicChampions from '@/pages/PublicChampions';
import PublicChampionDetail from '@/pages/PublicChampionDetail';
import PublicItems from '@/pages/PublicItems';
import PublicRunes from '@/pages/PublicRunes';

// La biblioteca pública scrollea dentro de .rd-main-content (como la app); la home, con window.
const LIBRARY_PATH = /^\/(campeones|objetos|runas)(\/|$)/;

export default function PublicRoutes({ publicData }) {
  const champions = publicData?.champions;
  const { pathname } = useLocation();
  const inLibrary = LIBRARY_PATH.test(pathname);

  return (
    <>
      {/* Grilla de puntos y halo que sigue al mouse, igual que en la app. */}
      <AnimatedBackground
        key={inLibrary ? 'library' : 'window'}
        scrollSelector={inLibrary ? '.rd-main-content' : undefined}
      />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/campeones" element={<PublicChampions initialChampions={champions} initialTierlist={publicData?.tierlist} />} />
        <Route path="/campeones/:slug" element={<PublicChampionDetail initialChampions={champions} initialTierlist={publicData?.tierlist} />} />
        <Route path="/objetos" element={<PublicItems initialItems={publicData?.items} initialChampions={champions} />} />
        <Route path="/objetos/:slug" element={<PublicItems initialItems={publicData?.items} initialChampions={champions} />} />
        <Route path="/runas" element={<PublicRunes initialRunes={publicData?.runes} />} />
        <Route path="/runas/:slug" element={<PublicRunes initialRunes={publicData?.runes} />} />
      </Routes>
    </>
  );
}
