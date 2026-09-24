import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { usePersistentState } from '../../shared/storage';
import { COUNTRIES } from './lib/data';
import { applyFilters, DEFAULT_FILTERS, GROUPS, PRESETS } from './lib/filters';
import type { QType } from './lib/questions';
import type { Country, Filters, Settings } from './lib/types';

export interface MapScene {
  focus?: string | null;
  set?: string[] | null;
  /** Neighbours of the focused country – drawn with a light outline. */
  neighbors?: string[] | null;
  /** 0…1 per country (learning progress) – colours the whole map. */
  heat?: Record<string, number> | null;
  /** Map games: countries already found (green) and given up (red). */
  found?: string[] | null;
  missed?: string[] | null;
  /** "Wo liegt …?": the player's guess, the right place and a label for the right place. */
  guess?: [number, number] | null;
  truth?: [number, number] | null;
  truthLabel?: string;
  correct?: string | null;
  wrong?: string | null;
  capital?: boolean;
  capitalLabel?: boolean;
  hoverNames?: boolean;
  hideLabels?: boolean;
  fly?: 'focus' | 'set' | 'world' | 'pins' | 'view' | 'none';
  /** Area to show with fly: 'view' – [[south, west], [north, east]]. */
  view?: [[number, number], [number, number]] | null;
  flyKey?: string | number;
  /** select/answer: click on a country · point: click anywhere (map games) */
  clickable?: 'select' | 'answer' | 'point' | null;
}

export interface CardProgress {
  box: number;
  right: number;
  wrong: number;
  last: number;
}
export type Progress = Record<string, CardProgress>;
/** Answers per day ("2026-09-24" → 42) – for the learning streak. */
export type DayLog = Record<string, number>;

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
  mapStyle: 'satellite',
  speech: true,
  sound: true,
};

interface AppState {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  filtered: Country[];
  progress: Progress;
  days: DayLog;
  recordAnswer: (key: string, correct: boolean) => void;
  resetProgress: () => void;
  scene: MapScene;
  setScene: (s: MapScene) => void;
  mapClickRef: MutableRefObject<((iso2: string) => void) | null>;
  mapPointRef: MutableRefObject<((lat: number, lng: number) => void) | null>;
  isMobile: boolean;
  openMap: () => void;
  /** Desktop: map takes the whole width (content hidden). */
  mapMax: boolean;
  setMapMax: (v: boolean) => void;
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
  const [days, setDays] = usePersistentState<DayLog>('laender:days', {});
  const [scene, setScene] = useState<MapScene>({ fly: 'world', flyKey: 'init' });
  const mapClickRef = useRef<((iso2: string) => void) | null>(null);
  const mapPointRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [mapMax, setMapMax] = useState(false);

  // Links like "laender/?filter=es" (from the start page) open the app with a ready-made filter.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preset = PRESETS.find((p) => p.id === params.get('filter'));
    const group = GROUPS.find((g) => g.id === params.get('filter'));
    if (!params.has('filter')) return;
    if (preset) setFiltersState({ ...DEFAULT_FILTERS, ...preset.filters });
    else if (group) setFiltersState({ ...DEFAULT_FILTERS, group: group.id });
    params.delete('filter');
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  }, [setFiltersState]);

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [setSettings]);
  const setFilters = useCallback((f: Filters) => setFiltersState(f), [setFiltersState]);
  const filtered = useMemo(() => applyFilters(COUNTRIES, filters), [filters]);

  const recordAnswer = useCallback(
    (key: string, correct: boolean) => {
      const today = dayKey();
      setDays((d) => ({ ...d, [today]: (d[today] ?? 0) + 1 }));
      setProgress((p) => {
        const cur = p[key] ?? { box: 0, right: 0, wrong: 0, last: 0 };
        const next: CardProgress = {
          box: correct ? Math.min(5, cur.box + 1) : 1,
          right: cur.right + (correct ? 1 : 0),
          wrong: cur.wrong + (correct ? 0 : 1),
          last: Date.now(),
        };
        return { ...p, [key]: next };
      });
    },
    [setProgress, setDays],
  );
  const resetProgress = useCallback(() => {
    setProgress({});
    setDays({});
  }, [setProgress, setDays]);
  const openMap = useCallback(() => updateSettings({ mapOpen: true }), [updateSettings]);

  const value = useMemo<AppState>(
    () => ({ settings, updateSettings, filters, setFilters, filtered, progress, days, recordAnswer, resetProgress, scene, setScene, mapClickRef, mapPointRef, isMobile, openMap, mapMax: mapMax && !isMobile, setMapMax }),
    [settings, updateSettings, filters, setFilters, filtered, progress, days, recordAnswer, resetProgress, scene, isMobile, openMap, mapMax],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp außerhalb von AppProvider');
  return v;
}
