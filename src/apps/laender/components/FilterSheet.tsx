import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CONTINENTS, COUNTRIES, LANGUAGE_OPTIONS, normalize } from '../lib/data';
import { applyFilters, DEFAULT_FILTERS, GROUPS, LANG_MODES, PRESETS } from '../lib/filters';
import type { ContinentId, Filters } from '../lib/types';
import { useApp } from '../state';
import Flag from './Flag';
import Sheet from './Sheet';

export default function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { filters, setFilters } = useApp();
  const [langQuery, setLangQuery] = useState('');
  const count = useMemo(() => applyFilters(COUNTRIES, filters).length, [filters]);

  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const toggleContinent = (id: ContinentId) =>
    set({ continents: filters.continents.includes(id) ? filters.continents.filter((c) => c !== id) : [...filters.continents, id] });

  const langs = useMemo(() => {
    const q = normalize(langQuery);
    const list = q ? LANGUAGE_OPTIONS.filter((l) => normalize(l.label).includes(q)) : LANGUAGE_OPTIONS.filter((l) => l.count >= 2);
    return list.slice(0, q ? 40 : 24);
  }, [langQuery]);

  const activePreset = PRESETS.find((p) => (p.filters.lang ?? '') === filters.lang && (!p.filters.lang || filters.langMode === 'official') && !filters.continents.length && !filters.group)?.id;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filter"
      footer={
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Zurücksetzen
          </button>
          <button type="button" className="btn btn-primary flex-1" onClick={onClose}>
            {count} {count === 1 ? 'Land' : 'Länder'} anzeigen
          </button>
        </div>
      }
    >
      <section className="space-y-3">
        <h3 className="label">Schnellauswahl</h3>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={activePreset === p.id} onClick={() => set({ ...DEFAULT_FILTERS, includeSpecial: filters.includeSpecial, ...p.filters })}>
              {p.flag && <Flag iso={p.flag} alt="" className="!h-4 !w-auto rounded-[3px]" />}
              {p.id === 'all' ? p.label : `${p.label}sprachig`}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-7 space-y-3">
        <h3 className="label">Sprache</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {LANG_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={filters.langMode === m.id}
              className="mode-option"
              onClick={() => set({ langMode: m.id })}
            >
              <span className="flex items-center justify-between gap-2 font-bold">
                {m.label}
                {filters.langMode === m.id && <Check size={16} />}
              </span>
              <span className="mt-1 block text-xs font-medium text-muted">{m.hint}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          value={langQuery}
          onChange={(e) => setLangQuery(e.target.value)}
          placeholder="Sprache suchen, z. B. Quechua …"
          className="input"
          aria-label="Sprache suchen"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="chip" aria-pressed={!filters.lang} onClick={() => set({ lang: '' })}>
            Alle Sprachen
          </button>
          {langs.map((l) => (
            <button key={l.code} type="button" className="chip" aria-pressed={filters.lang === l.code} onClick={() => set({ lang: filters.lang === l.code ? '' : l.code })}>
              {l.label}
              <span className="text-xs font-bold text-muted">{l.count}</span>
            </button>
          ))}
          {!langs.length && <p className="text-sm text-muted">Keine Sprache gefunden.</p>}
        </div>
        <p className="text-xs text-muted">Die Zahl zeigt, in wie vielen Ländern die Sprache Amtssprache ist.</p>
      </section>

      <section className="mt-7 space-y-3">
        <h3 className="label">Gruppe</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="chip" aria-pressed={!filters.group} onClick={() => set({ group: '' })}>
            Alle
          </button>
          {GROUPS.map((g) => (
            <button key={g.id} type="button" className="chip" aria-pressed={filters.group === g.id} onClick={() => set({ group: filters.group === g.id ? '' : g.id })} title={g.hint}>
              {g.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-7 space-y-3">
        <h3 className="label">Kontinent</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="chip" aria-pressed={!filters.continents.length} onClick={() => set({ continents: [] })}>
            Alle
          </button>
          {CONTINENTS.map((c) => (
            <button key={c.id} type="button" className="chip" aria-pressed={filters.continents.includes(c.id)} onClick={() => toggleContinent(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <label className="toggle-row">
          <input type="checkbox" checked={filters.includeSpecial} onChange={(e) => set({ includeSpecial: e.target.checked })} />
          <span>
            <b>Auch Sonderfälle zeigen</b>
            <span className="block text-sm text-muted">Vatikanstadt, Palästina, Kosovo, Taiwan und Puerto Rico (keine vollen UN-Mitglieder).</span>
          </span>
        </label>
      </section>
    </Sheet>
  );
}
