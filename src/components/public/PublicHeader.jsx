import { Link } from 'react-router-dom';
import wordmarkUrl from '@/assets/riftdeck-final.png';

export default function PublicHeader() {
  return (
    <header className="border-b border-primary/10 bg-card/90 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-[1800px] items-center justify-between px-3 py-2.5 md:px-5" aria-label="Navegación pública">
        <Link to="/" className="flex items-center" aria-label="Rift Deck, inicio">
          <img src={wordmarkUrl} alt="Rift Deck" height="48" className="h-12 w-auto object-contain" />
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/campeones" className="font-medium text-primary hover:text-primary/80">Campeones</Link>
          <Link to="/login" className="text-muted-foreground hover:text-foreground">Ingresar</Link>
        </div>
      </nav>
    </header>
  );
}
