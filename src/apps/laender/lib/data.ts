import countriesJson from '../data/countries.json';
import languagesJson from '../data/languages.json';
import type { ContinentId, Country, Lang, Names } from './types';

export const COUNTRIES = (countriesJson as unknown as Country[])
  .slice()
  .sort((a, b) => a.name.de.localeCompare(b.name.de, 'de'));

export const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso2, c]));

export const LANGUAGES = languagesJson as Record<string, Names>;

const flagModules = import.meta.glob<string>('../data/flags/*.svg', { eager: true, query: '?url', import: 'default' });
const FLAGS = new Map(Object.entries(flagModules).map(([path, url]) => [path.slice(-6, -4), url]));

export function flagUrl(iso2: string): string {
  return FLAGS.get(iso2) ?? '';
}

export const CONTINENTS: { id: ContinentId; label: string }[] = [
  { id: 'europe', label: 'Europa' },
  { id: 'asia', label: 'Asien' },
  { id: 'africa', label: 'Afrika' },
  { id: 'north-america', label: 'Nordamerika' },
  { id: 'south-america', label: 'Südamerika' },
  { id: 'oceania', label: 'Ozeanien' },
];

export const CONTINENT_LABEL = Object.fromEntries(CONTINENTS.map((c) => [c.id, c.label])) as Record<ContinentId, string>;

export const STATUS_LABEL: Record<Country['status'], string | null> = {
  un: null,
  observer: 'UN-Beobachterstaat',
  partial: 'Teilweise anerkannt',
  territory: 'Außengebiet der USA',
};

export const LANG_LABEL: Record<Lang, string> = { de: 'Deutsch', es: 'Español', en: 'English' };

export const nameOf = (c: Country, lang: Lang) => c.name[lang];
export const capitalOf = (c: Country, lang: Lang) => c.capital[lang];
export const languageName = (code: string) => LANGUAGES[code]?.de ?? code;

/** Languages that are official somewhere, sorted by how many countries use them. */
export const LANGUAGE_OPTIONS = (() => {
  const count = new Map<string, number>();
  for (const c of COUNTRIES) {
    for (const code of new Set([...c.languages.official, ...c.languages.regional, ...c.languages.spoken])) {
      count.set(code, (count.get(code) ?? 0) + (c.languages.official.includes(code) ? 1 : 0));
    }
  }
  return [...count.entries()]
    .filter(([code]) => LANGUAGES[code])
    .map(([code, n]) => ({ code, label: LANGUAGES[code].de, count: n }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'de'));
})();

const nf = new Intl.NumberFormat('de-AT');
const df = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 1 });

export function formatPopulation(value: number): string {
  if (value >= 1e9) return `${df.format(value / 1e9)} Mrd.`;
  if (value >= 1e6) return `${df.format(value / 1e6)} Mio.`;
  return nf.format(value);
}

export function formatArea(km2: number): string {
  return `${nf.format(Math.round(km2))} km²`;
}

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function matchesSearch(c: Country, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const hay = [c.name.de, c.name.es, c.name.en, c.capital.de, c.capital.es, c.capital.en, c.iso2, c.iso3, ...c.aliases];
  return hay.some((h) => normalize(h).includes(q));
}
