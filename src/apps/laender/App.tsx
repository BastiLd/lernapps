import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import ExploreView from './components/ExploreView';
import FilterSheet from './components/FilterSheet';
import FlashcardsView from './components/FlashcardsView';
import MapPanel from './components/MapPanel';
import QuizView from './components/QuizView';
import SearchPalette from './components/SearchPalette';
import SettingsSheet from './components/SettingsSheet';
import TopBar, { BottomNav } from './components/TopBar';
import { useRoute, type View } from './lib/router';
import { dialogOpen, isTyping } from './lib/ui';
import { useApp } from './state';

const StatsView = lazy(() => import('./components/StatsView'));
const GamesView = lazy(() => import('./components/GamesView'));

const TITLES: Record<View, string> = { explore: 'Entdecken', cards: 'Karteikarten', quiz: 'Quiz', games: 'Spiele', stats: 'Fortschritt' };

export default function App() {
  const [route, navigate] = useRoute();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { settings, isMobile, mapMax, setMapMax } = useApp();

  const mapFirst = isMobile ? settings.mapMobileSide === 'top' : settings.mapSide === 'left';
  const selectCountry = useCallback(
    (iso?: string) => {
      setMapMax(false);
      navigate({ view: 'explore', iso });
    },
    [navigate, setMapMax],
  );

  useEffect(() => {
    document.title = `${TITLES[route.view]} · Länder der Welt`;
  }, [route.view]);

  // Ctrl+K / Cmd+K or "/" opens the search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !isTyping(e.target) && !dialogOpen())) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goView = (v: View) => {
    setMapMax(false);
    navigate({ view: v });
  };

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Zum Inhalt springen
      </a>
      <TopBar view={route.view} onView={goView} onFilters={() => setFiltersOpen(true)} onSettings={() => setSettingsOpen(true)} onSearch={() => setSearchOpen(true)} />
      <div className={`app-body ${isMobile ? 'is-mobile' : 'is-desktop'} ${mapMax ? 'is-map-max' : ''}`} data-map-first={mapFirst}>
        <main id="main" className="app-main scroll-thin" tabIndex={-1}>
          {route.view === 'explore' && <ExploreView iso={route.iso} onSelect={selectCountry} />}
          {route.view === 'cards' && <FlashcardsView />}
          {route.view === 'quiz' && <QuizView />}
          {route.view === 'games' && (
            <Suspense fallback={<div className="p-10 text-center text-muted">Lade …</div>}>
              <GamesView />
            </Suspense>
          )}
          {route.view === 'stats' && (
            <Suspense fallback={<div className="p-10 text-center text-muted">Lade …</div>}>
              <StatsView onSelect={selectCountry} />
            </Suspense>
          )}
        </main>
        <MapPanel />
      </div>
      <BottomNav view={route.view} onView={goView} />
      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} onPick={(iso) => selectCountry(iso)} />
    </div>
  );
}
