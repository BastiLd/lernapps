import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { usePersistentState } from '../../shared/storage';
import { COUNTRIES } from './lib/data';
import { applyFilters, DEFAULT_FILTERS } from './lib/filters';
import type { QType } from './lib/questions';
import type { Country, Filters, Settings } from './lib/types';

export interface MapScene {
  focus?: string | null;
  set?: string[] | null;
  correct?: string | null;
  wrong?: string | null;
  capital?: boolean;
  capitalLabel?: boolean;
  hoverNames?: boolean;
  hideLabels?: boolean;
  fly?: 'focus' | 'set' | 'world' | 'none';
  flyKey?: string | number;
  clickable?: 'select' | 'answer' | null;
}

export interface CardProgress {
  box: number;
  right: number;
  wrong: number;
  last: number;
}
export type Progress = Record<string, CardProgress>;

export const cardKey = (type: QType, iso2: string) => `${type}:${iso2}`;

const DEFAULT_SETTINGS: Settings = {
  nameLang: 'de',
  showSecondary: true,
  mapOpen: true,
  mapSide: 'right',
  mapMobileSide: 'top',
  mapMobileSize: 'half',
  mapWidth: 0,
  mapLabels: false,
  mapBorders: true,
};

interface AppState {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  filtered: Country[];
  progress: Progress;
  recordAnswer: (key: string, correct: boolean) => void;
  resetProgress: () => void;
  scene: MapScene;
  setScene: (s: MapScene) => void;
  mapClickRef: MutableRefObject<((iso2: string) => void) | null>;
  isMobile: boolean;
  openMap: () => void;
}

const Ctx = createContext<AppState | null>(null);

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = usePersistentState<Settings>('laender:settings', DEFAULT_SETTINGS);
  const [filters, setFiltersState] = usePersistentState<Filters>('laender:filters', DEFAULT_FILTERS);
  const [progress, setProgress] = usePersistentState<Progress>('laender:progress', {});
  const [scene, setScene] = useState<MapScene>({ fly: 'world', flyKey: 'init' });
  const mapClickRef = useRef<((iso2: string) => void) | null>(null);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [setSettings]);
  const setFilters = useCallback((f: Filters) => setFiltersState(f), [setFiltersState]);
  const filtered = useMemo(() => applyFilters(COUNTRIES, filters), [filters]);

  const recordAnswer = useCallback(
    (key: string, correct: boolean) =>
      setProgress((p) => {
        const cur = p[key] ?? { box: 0, right: 0, wrong: 0, last: 0 };
        const next: CardProgress = {
          box: correct ? Math.min(5, cur.box + 1) : 1,
          right: cur.right + (correct ? 1 : 0),
          wrong: cur.wrong + (correct ? 0 : 1),
          last: Date.now(),
        };
        return { ...p, [key]: next };
      }),
    [setProgress],
  );
  const resetProgress = useCallback(() => setProgress({}), [setProgress]);
  const openMap = useCallback(() => updateSettings({ mapOpen: true }), [updateSettings]);

  const value = useMemo<AppState>(
    () => ({ settings, updateSettings, filters, setFilters, filtered, progress, recordAnswer, resetProgress, scene, setScene, mapClickRef, isMobile, openMap }),
    [settings, updateSettings, filters, setFilters, filtered, progress, recordAnswer, resetProgress, scene, isMobile, openMap],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp außerhalb von AppProvider');
  return v;
}
