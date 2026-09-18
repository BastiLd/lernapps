import { ChevronRight, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentState } from '../../../shared/storage';
import { BY_ISO, COUNTRIES, matchesSearch } from '../lib/data';
import type { Country, Lang } from '../lib/types';
import { useApp } from '../state';
import CountryDetail from './CountryDetail';
import Flag from './Flag';

type SortKey = 'name' | 'population' | 'area';

function secondaryLine(c: Country, lang: Lang, showSecondary: boolean) {
  const capital = c.capital[lang];
  if (!showSecondary) return capital;
  const other: Lang = lang === 'es' ? 'de' : 'es';
  return `${capital} · ${c.name[other]}`;
}

export default function ExploreView({ iso, onSelect }: { iso?: string; onSelect: (iso?: string) => void }) {
  const { filtered, settings, setScene, mapClickRef } = useApp();
  const [query, setQuery] = useState('');
  const [sort, setSort] = usePersistentState<SortKey>('laender:sort', 'name');
  const listRef = useRef<HTMLDivElement>(null);
  const lang = settings.nameLang;

  const list = useMemo(() => {
    const l = filtered.filter((c) => matchesSearch(c, query));
    if (sort === 'population') return l.sort((a, b) => (b.population?.value ?? 0) - (a.population?.value ?? 0));
    if (sort === 'area') return l.sort((a, b) => b.area - a.area);
    return l.sort((a, b) => a.name[lang].localeCompare(b.name[lang], lang));
  }, [filtered, query, sort, lang]);

  const selected = iso ? BY_ISO.get(iso) : undefined;
  const index = selected ? list.findIndex((c) => c.iso2 === selected.iso2) : -1;
  const isAll = filtered.length === COUNTRIES.length;
  const setKey = filtered.map((c) => c.iso2).join(',');

  useEffect(() => {
    setScene({
      set: isAll ? null : filtered.map((c) => c.iso2),
      focus: selected?.iso2 ?? null,
      capital: Boolean(selected),
      capitalLabel: true,
      hoverNames: true,
      clickable: 'select',
      fly: selected ? 'focus' : isAll ? 'world' : 'set',
      flyKey: selected ? `c-${selected.iso2}` : `s-${setKey}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.iso2, setKey]);

  useEffect(() => {
    mapClickRef.current = (clicked) => {
      if (BY_ISO.has(clicked)) onSelect(clicked);
    };
    return () => {
      mapClickRef.current = null;
    };
  }, [mapClickRef, onSelect]);

  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // A newly opened country starts at the top (both in the one-column and the two-column layout).
    document.getElementById('main')?.scrollTo({ top: 0 });
    detailRef.current?.scrollTo({ top: 0 });
    if (selected) listRef.current?.querySelector<HTMLElement>(`[data-iso="${selected.iso2}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const goto = (i: number) => {
    const c = list[i];
    if (c) onSelect(c.iso2);
  };

  return (
    <div className={`explore ${selected ? 'has-selection' : ''}`}>
      <section className="explore-list" aria-label="Länderliste">
        <div className="explore-list-head">
          <div className="search">
            <Search size={18} aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Land oder Hauptstadt suchen …" aria-label="Land oder Hauptstadt suchen" />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Suche leeren">
                <X size={16} />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-muted">
              {list.length} {list.length === 1 ? 'Land' : 'Länder'}
            </p>
            <label className="flex items-center gap-2 text-sm font-semibold text-muted">
              Sortieren
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="name">A–Z</option>
                <option value="population">Einwohner</option>
                <option value="area">Fläche</option>
              </select>
            </label>
          </div>
        </div>
        <div ref={listRef} className="explore-items scroll-thin" role="list">
          {list.map((c) => (
            <button key={c.iso2} type="button" role="listitem" data-iso={c.iso2} className="country-row" aria-current={c.iso2 === selected?.iso2 ? 'true' : undefined} onClick={() => onSelect(c.iso2)}>
              <Flag iso={c.iso2} alt="" className="country-row-flag" />
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate font-bold">{c.name[lang]}</span>
                <span className="block truncate text-sm text-muted">{secondaryLine(c, lang, settings.showSecondary)}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-muted" />
            </button>
          ))}
          {!list.length && (
            <div className="p-8 text-center text-sm text-muted">
              Kein Land gefunden{query ? ` für „${query}“` : ''}. Tipp: Filter prüfen oder anders schreiben.
            </div>
          )}
        </div>
      </section>

      <section ref={detailRef} className="explore-detail scroll-thin" aria-live="polite">
        {selected ? (
          <CountryDetail
            country={selected}
            position={index >= 0 ? { index, total: list.length } : undefined}
            onSelect={onSelect}
            onPrev={index > 0 ? () => goto(index - 1) : undefined}
            onNext={index >= 0 && index < list.length - 1 ? () => goto(index + 1) : undefined}
            onBack={() => onSelect(undefined)}
          />
        ) : (
          <div className="explore-empty">
            <div className="explore-empty-flags" aria-hidden="true">
              {filtered.slice(0, 12).map((c) => (
                <Flag key={c.iso2} iso={c.iso2} alt="" />
              ))}
            </div>
            <h2 className="text-2xl font-extrabold">Wähle ein Land</h2>
            <p className="mx-auto mt-2 max-w-md text-muted">
              Klicke links auf ein Land oder direkt auf der Karte. Über <b>Filter</b> kannst du z. B. nur die Länder zeigen, in denen Spanisch Amtssprache ist.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
