import { ChartNoAxesColumn, Compass, Layers, LayoutGrid, Search, Settings2, SlidersHorizontal, Trophy, X } from 'lucide-react';
import { describeFilters, DEFAULT_FILTERS, isFiltered } from '../lib/filters';
import type { View } from '../lib/router';
import { useApp } from '../state';

export const TABS: { id: View; label: string; short: string; icon: typeof Compass }[] = [
  { id: 'explore', label: 'Entdecken', short: 'Entdecken', icon: Compass },
  { id: 'cards', label: 'Karteikarten', short: 'Karten', icon: Layers },
  { id: 'quiz', label: 'Quiz', short: 'Quiz', icon: Trophy },
  { id: 'stats', label: 'Fortschritt', short: 'Fortschritt', icon: ChartNoAxesColumn },
];

interface Props {
  view: View;
  onView: (v: View) => void;
  onFilters: () => void;
  onSettings: () => void;
  onSearch: () => void;
}

export function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true" className="brand-mark">
      <rect width="32" height="32" rx="10" fill="var(--primary)" />
      <circle cx="16" cy="16" r="9.2" fill="none" stroke="var(--on-primary)" strokeWidth="1.8" />
      <ellipse cx="16" cy="16" rx="4.2" ry="9.2" fill="none" stroke="var(--on-primary)" strokeWidth="1.5" />
      <path d="M7 13h18M7 19h18" stroke="var(--on-primary)" strokeWidth="1.5" />
      <circle cx="22.5" cy="9.5" r="3" fill="var(--sun)" stroke="var(--primary)" strokeWidth="1.2" />
    </svg>
  );
}

export default function TopBar({ view, onView, onFilters, onSettings, onSearch }: Props) {
  const { filters, setFilters, filtered } = useApp();
  const active = isFiltered(filters);

  return (
    <header className="topbar">
      <div className="topbar-row">
        <a href={import.meta.env.BASE_URL} className="topbar-home" aria-label="Zur Übersicht aller Lernapps" title="Alle Lernapps">
          <BrandMark />
          <LayoutGrid size={14} className="topbar-home-grid" aria-hidden="true" />
        </a>
        <div className="min-w-0 flex-1 lg:flex-none">
          <h1 className="topbar-title">Länder der Welt</h1>
          <p className="truncate text-xs font-semibold text-muted">
            {filtered.length} Länder · {describeFilters(filters)}
          </p>
        </div>

        <nav className="tabs hidden md:flex" aria-label="Bereiche">
          {TABS.map((t) => (
            <button key={t.id} type="button" className="tab" aria-current={view === t.id ? 'page' : undefined} onClick={() => onView(t.id)}>
              <t.icon size={18} />
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button type="button" className="search-trigger" onClick={onSearch} aria-label="Land suchen (Strg+K)" title="Land suchen (Strg+K)">
            <Search size={18} />
            <span className="search-trigger-text">Suchen</span>
            <kbd className="search-trigger-kbd">Strg K</kbd>
          </button>
          <button type="button" className={`btn btn-ghost btn-filter relative ${active ? 'is-filtered' : ''}`} onClick={onFilters} aria-label="Filter öffnen" title="Filter">
            <SlidersHorizontal size={18} />
            <span className="hidden lg:inline">Filter</span>
            {active && <span className="filter-dot" aria-hidden="true" />}
          </button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onSettings} aria-label="Einstellungen" title="Einstellungen">
            <Settings2 size={19} />
          </button>
        </div>
      </div>

      {active && (
        <div className="filter-strip">
          <span className="truncate">
            <b>Filter:</b> {describeFilters(filters)}
          </span>
          <button type="button" className="filter-strip-clear" onClick={() => setFilters(DEFAULT_FILTERS)} aria-label="Filter zurücksetzen">
            <X size={15} /> Zurücksetzen
          </button>
        </div>
      )}
    </header>
  );
}

/** Phone navigation at the bottom of the screen (easier to reach with the thumb). */
export function BottomNav({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <nav className="bottom-nav md:hidden" aria-label="Bereiche">
      {TABS.map((t) => (
        <button key={t.id} type="button" className="bottom-tab" aria-current={view === t.id ? 'page' : undefined} onClick={() => onView(t.id)}>
          <t.icon size={21} />
          <span>{t.short}</span>
        </button>
      ))}
    </nav>
  );
}
