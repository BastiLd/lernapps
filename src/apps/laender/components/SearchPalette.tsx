import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { COUNTRIES, matchesSearch, normalize } from '../lib/data';
import type { Country } from '../lib/types';
import { useApp } from '../state';
import Flag from './Flag';

/** Names starting with the query come first, then the rest alphabetically. */
function rank(c: Country, q: string): number {
  const n = normalize(q);
  const names = [c.name.de, c.name.es, c.name.en].map(normalize);
  if (names.some((x) => x === n)) return 0;
  if (names.some((x) => x.startsWith(n))) return 1;
  if ([c.capital.de, c.capital.es].map(normalize).some((x) => x.startsWith(n))) return 2;
  return 3;
}

export default function SearchPalette({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (iso: string) => void }) {
  const { settings } = useApp();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const lang = settings.nameLang;

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return COUNTRIES.filter((c) => matchesSearch(c, query))
      .sort((a, b) => rank(a, query) - rank(b, query) || a.name[lang].localeCompare(b.name[lang], lang))
      .slice(0, 8);
  }, [query, lang]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const t = window.setTimeout(() => input.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  const pick = (c: Country | undefined) => {
    if (!c) return;
    onPick(c.iso2);
    onClose();
  };

  return (
    <div className="palette-root" role="presentation" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Land suchen">
        <div className="palette-input">
          <Search size={20} aria-hidden="true" />
          <input
            ref={input}
            type="search"
            value={query}
            placeholder="Land, Hauptstadt oder spanischer Name …"
            aria-label="Land suchen"
            aria-controls="palette-results"
            aria-activedescendant={results[active] ? `pal-${results[active].iso2}` : undefined}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                pick(results[active]);
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <ul id="palette-results" className="palette-results" role="listbox">
          {results.map((c, i) => (
            <li key={c.iso2} id={`pal-${c.iso2}`} role="option" aria-selected={i === active}>
              <button type="button" className="palette-item" onMouseEnter={() => setActive(i)} onClick={() => pick(c)}>
                <Flag iso={c.iso2} alt="" className="palette-flag" />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-bold">{c.name[lang]}</span>
                  <span className="block truncate text-sm text-muted">
                    {c.capital[lang]} · <span lang="es">{c.name.es}</span>
                  </span>
                </span>
                {i === active && <CornerDownLeft size={16} className="shrink-0 text-muted" />}
              </button>
            </li>
          ))}
        </ul>
        {query.trim() && !results.length && <p className="px-5 pb-5 text-sm text-muted">Nichts gefunden für „{query}“.</p>}
        {!query.trim() && <p className="px-5 pb-5 text-sm text-muted">Tipp: Auch „Madrid“, „Alemania“ oder „DE“ funktionieren.</p>}
      </div>
    </div>
  );
}
