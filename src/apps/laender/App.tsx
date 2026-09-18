import { useCallback, useEffect, useState } from 'react';
import ExploreView from './components/ExploreView';
import FilterSheet from './components/FilterSheet';
import FlashcardsView from './components/FlashcardsView';
import MapPanel from './components/MapPanel';
import QuizView from './components/QuizView';
import SettingsSheet from './components/SettingsSheet';
import TopBar from './components/TopBar';
import { useRoute, type View } from './lib/router';
import { useApp } from './state';

const TITLES: Record<View, string> = { explore: 'Entdecken', cards: 'Karteikarten', quiz: 'Quiz' };

export default function App() {
  const [route, navigate] = useRoute();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, isMobile } = useApp();

  const mapFirst = isMobile ? settings.mapMobileSide === 'top' : settings.mapSide === 'left';
  const selectCountry = useCallback((iso?: string) => navigate({ view: 'explore', iso }), [navigate]);

  useEffect(() => {
    document.title = `${TITLES[route.view]} · Länder der Welt`;
  }, [route.view]);

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Zum Inhalt springen
      </a>
      <TopBar view={route.view} onView={(v) => navigate({ view: v })} onFilters={() => setFiltersOpen(true)} onSettings={() => setSettingsOpen(true)} />
      <div className={`app-body ${isMobile ? 'is-mobile' : 'is-desktop'}`} data-map-first={mapFirst}>
        <main id="main" className="app-main scroll-thin" tabIndex={-1}>
          {route.view === 'explore' && <ExploreView iso={route.iso} onSelect={selectCountry} />}
          {route.view === 'cards' && <FlashcardsView />}
          {route.view === 'quiz' && <QuizView />}
        </main>
        <MapPanel />
      </div>
      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
