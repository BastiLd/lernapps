import { ChevronRight, Download, List, Printer, Search, Table2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentState } from '../../../shared/storage';
import { heatColor } from '../lib/colors';
import { BY_ISO, COUNTRIES, CONTINENT_LABEL, formatPopulation, languageName, matchesSearch } from '../lib/data';
import { describeFilters } from '../lib/filters';
import type { Country, Lang } from '../lib/types';
import { useApp } from '../state';
import CountryDetail from './CountryDetail';
import Flag from './Flag';
import Silhouette from './Silhouette';

type SortKey = 'name' | 'population' | 'area' | 'capital';
type Layout = 'list' | 'table';

function secondaryLine(c: Country, lang: Lang, showSecondary: boolean) {
  const capital = c.capital[lang];
  if (!showSecondary) return capital;
  const other: Lang = lang === 'es' ? 'de' : 'es';
  return `${capital} · ${c.name[other]}`;
}

const demonymEs = (c: Country) => (c.demonym ? (c.demonym.esM === c.demonym.esF ? c.demonym.esM : `${c.demonym.esM} / ${c.demonym.esF}`) : '–');

function downloadCsv(list: Country[]) {
  const rows = [
    ['Land', 'Spanisch', 'Englisch', 'Hauptstadt', 'Hauptstadt (Spanisch)', 'Einwohner (Spanisch)', 'Amtssprachen', 'Kontinent', 'Einwohnerzahl', 'Fläche km²', 'Währung'],
    ...list.map((c) => [
      c.name.de,
      c.name.es,
      c.name.en,
      c.capital.de,
      c.capital.es,
      demonymEs(c),
      c.languages.official.map(languageName).join(', '),
      c.continents.map((k) => CONTINENT_LABEL[k]).join(' / '),
      String(c.population?.value ?? ''),
      String(Math.round(c.area)),
      c.currencies.map((x) => x.de).join(', '),
    ]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(';')).join('\r\n');
  // BOM so Excel opens the umlauts correctly.
  const blob = new Blob([String.fromCharCode(0xfeff), csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'laender.csv';
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function CountryTable({ list, onSelect }: { list: Country[]; onSelect: (iso: string) => void }) {
  const { filters, settings } = useApp();
  const lang = settings.nameLang;
  return (
    <section className="table-view" aria-label="Ländertabelle">
      <div className="table-toolbar">
        <div className="min-w-0">
          <h2 className="study-title !text-2xl">Lernliste</h2>
          <p className="text-sm text-muted">
            {list.length} {list.length === 1 ? 'Land' : 'Länder'} · {describeFilters(filters)}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
            <Printer size={17} /> Drucken / PDF
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => downloadCsv(list)}>
            <Download size={17} /> Excel (CSV)
          </button>
        </div>
      </div>
      <div className="table-scroll scroll-thin">
        <table className="country-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Flagge</span>
              </th>
              <th scope="col">Land</th>
              <th scope="col" lang="es">
                Español
              </th>
              <th scope="col">Hauptstadt</th>
              <th scope="col" lang="es">
                Capital
              </th>
              <th scope="col" lang="es">
                Gentilicio
              </th>
              <th scope="col">Amtssprachen</th>
              <th scope="col" className="text-right">
                Einwohner
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.iso2} onClick={() => onSelect(c.iso2)}>
                <td>
                  <Flag iso={c.iso2} alt="" className="table-flag" />
                </td>
                <th scope="row">
                  <button
                    type="button"
                    className="table-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(c.iso2);
                    }}
                  >
                    {c.name[lang === 'es' ? 'de' : lang]}
                  </button>
                </th>
                <td lang="es">{c.name.es}</td>
                <td>{c.capital[lang === 'es' ? 'de' : lang]}</td>
                <td lang="es">{c.capital.es}</td>
                <td lang="es">{demonymEs(c)}</td>
                <td>{c.languages.official.map(languageName).join(', ') || '–'}</td>
                <td className="text-right tabular-nums">{c.population ? formatPopulation(c.population.value) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="print-only mt-4 text-xs">Länder der Welt – Lernapps · Stand der Daten: 2026 · Quellen: Weltbank, geoBoundaries, world-countries</p>
    </section>
  );
}

export default function ExploreView({ iso, onSelect }: { iso?: string; onSelect: (iso?: string) => void }) {
  const { filtered, settings, setScene, mapClickRef, progress } = useApp();
  // Learning progress per country (0 … 1) for the little dot in the list.
  const mastery = useMemo(() => {
    const sum = new Map<string, { boxes: number; n: number }>();
    for (const [key, p] of Object.entries(progress)) {
      const iso = key.slice(key.indexOf(':') + 1);
      const cur = sum.get(iso) ?? { boxes: 0, n: 0 };
      sum.set(iso, { boxes: cur.boxes + Math.min(5, p.box), n: cur.n + 1 });
    }
    return new Map([...sum].map(([iso, v]) => [iso, v.boxes / (v.n * 5)]));
  }, [progress]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = usePersistentState<SortKey>('laender:sort', 'name');
  const [layout, setLayout] = usePersistentState<Layout>('laender:layout', 'list');
  const listRef = useRef<HTMLDivElement>(null);
  const lang = settings.nameLang;

  const list = useMemo(() => {
    const l = filtered.filter((c) => matchesSearch(c, query));
    if (sort === 'population') return l.sort((a, b) => (b.population?.value ?? 0) - (a.population?.value ?? 0));
    if (sort === 'area') return l.sort((a, b) => b.area - a.area);
    if (sort === 'capital') return l.sort((a, b) => a.capital[lang].localeCompare(b.capital[lang], lang));
    return l.sort((a, b) => a.name[lang].localeCompare(b.name[lang], lang));
  }, [filtered, query, sort, lang]);

  const selected = iso ? BY_ISO.get(iso) : undefined;
  const index = selected ? list.findIndex((c) => c.iso2 === selected.iso2) : -1;
  const isAll = filtered.length === COUNTRIES.length;
  const setKey = filtered.map((c) => c.iso2).join(',');
  const showTable = layout === 'table' && !selected;

  useEffect(() => {
    setScene({
      set: isAll ? null : filtered.map((c) => c.iso2),
      focus: selected?.iso2 ?? null,
      neighbors: selected?.borders ?? null,
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

  const head = (
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
        <div className="view-toggle" role="radiogroup" aria-label="Ansicht">
          <button type="button" role="radio" aria-checked={layout === 'list'} onClick={() => setLayout('list')} title="Liste">
            <List size={16} /> <span>Liste</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={layout === 'table'}
            onClick={() => {
              setLayout('table');
              if (selected) onSelect(undefined);
            }}
            title="Tabelle – zum Drucken oder für Excel"
          >
            <Table2 size={16} /> <span>Tabelle</span>
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-muted">
          <span className="sr-only sm:not-sr-only">Sortieren</span>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sortieren">
            <option value="name">A–Z</option>
            <option value="capital">Hauptstadt</option>
            <option value="population">Einwohner</option>
            <option value="area">Fläche</option>
          </select>
        </label>
      </div>
      <p className="text-xs font-bold text-muted">
        {list.length} {list.length === 1 ? 'Land' : 'Länder'}
      </p>
    </div>
  );

  if (showTable) {
    return (
      <div className="explore explore--table">
        <div className="explore-table-head">{head}</div>
        <CountryTable list={list} onSelect={(i) => onSelect(i)} />
      </div>
    );
  }

  return (
    <div className={`explore ${selected ? 'has-selection' : ''} ${layout === 'table' && selected ? 'is-solo' : ''}`}>
      <section className="explore-list" aria-label="Länderliste">
        {head}
        <div ref={listRef} className="explore-items scroll-thin" role="list">
          {list.map((c) => (
            <button key={c.iso2} type="button" role="listitem" data-iso={c.iso2} className="country-row" aria-current={c.iso2 === selected?.iso2 ? 'true' : undefined} onClick={() => onSelect(c.iso2)}>
              <Flag iso={c.iso2} alt="" className="country-row-flag" />
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate font-bold">{c.name[lang]}</span>
                <span className="block truncate text-sm text-muted">{secondaryLine(c, lang, settings.showSecondary)}</span>
              </span>
              {mastery.has(c.iso2) && (
                <span className="mastery-dot" style={{ background: heatColor(mastery.get(c.iso2)!) }} title={`Lernstand: ${Math.round(mastery.get(c.iso2)! * 100)} %`} />
              )}
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
          <div className="explore-empty contours">
            <div className="explore-empty-shapes" aria-hidden="true">
              {filtered
                .filter((c) => !c.small)
                .slice(0, 6)
                .map((c) => (
                  <Silhouette key={c.iso2} iso={c.iso2} />
                ))}
            </div>
            <h2 className="study-title">Wähle ein Land</h2>
            <p className="mx-auto mt-2 max-w-md text-muted">
              Klicke links auf ein Land oder direkt auf der Karte. Über <b>Filter</b> zeigst du z. B. nur die Länder, in denen Spanisch Amtssprache ist – und unter <b>Tabelle</b> bekommst du sie als Lernliste zum Ausdrucken.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
