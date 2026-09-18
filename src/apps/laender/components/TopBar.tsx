import { Compass, Layers, LayoutGrid, SlidersHorizontal, Settings2, Trophy, X } from 'lucide-react';
import { describeFilters, DEFAULT_FILTERS, isFiltered } from '../lib/filters';
import type { View } from '../lib/router';
import { useApp } from '../state';

const TABS: { id: View; label: string; short: string; icon: typeof Compass }[] = [
  { id: 'explore', label: 'Entdecken', short: 'Entdecken', icon: Compass },
  { id: 'cards', label: 'Karteikarten', short: 'Karten', icon: Layers },
  { id: 'quiz', label: 'Quiz', short: 'Quiz', icon: Trophy },
];

interface Props {
  view: View;
  onView: (v: View) => void;
  onFilters: () => void;
  onSettings: () => void;
}

export default function TopBar({ view, onView, onFilters, onSettings }: Props) {
  const { filters, setFilters, filtered } = useApp();
  const active = isFiltered(filters);

  return (
    <header className="topbar">
      <div className="topbar-row">
        <a href={import.meta.env.BASE_URL} className="btn btn-ghost btn-icon shrink-0" aria-label="Zur Übersicht aller Lernapps" title="Alle Lernapps">
          <LayoutGrid size={20} />
        </a>
        <div className="min-w-0 flex-1 lg:flex-none">
          <h1 className="truncate text-[1.05rem] font-extrabold leading-tight tracking-tight">Länder der Welt</h1>
          <p className="truncate text-xs font-semibold text-muted">{filtered.length} Länder · {describeFilters(filters)}</p>
        </div>

        <nav className="tabs hidden lg:flex" aria-label="Bereiche">
          {TABS.map((t) => (
            <button key={t.id} type="button" className="tab" aria-current={view === t.id ? 'page' : undefined} onClick={() => onView(t.id)}>
              <t.icon size={18} />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button type="button" className={`btn btn-ghost relative ${active ? 'is-filtered' : ''}`} onClick={onFilters} aria-label="Filter öffnen">
            <SlidersHorizontal size={18} />
            <span className="hidden lg:inline">Filter</span>
            {active && <span className="filter-dot" aria-hidden="true" />}
          </button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onSettings} aria-label="Einstellungen" title="Einstellungen">
            <Settings2 size={19} />
          </button>
        </div>
      </div>

      <nav className="tabs tabs-mobile lg:hidden" aria-label="Bereiche">
        {TABS.map((t) => (
          <button key={t.id} type="button" className="tab" aria-current={view === t.id ? 'page' : undefined} onClick={() => onView(t.id)}>
            <t.icon size={17} />
            {t.short}
          </button>
        ))}
      </nav>

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
