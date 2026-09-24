import { CONTINENT_LABEL, LANGUAGES } from './data';
import type { Country, Filters, GroupId, LangMode } from './types';

export const DEFAULT_FILTERS: Filters = { lang: '', langMode: 'official', continents: [], includeSpecial: true, group: '' };

/** Members of the European Union (2026). */
const EU = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']);

export const GROUPS: { id: Exclude<GroupId, ''>; label: string; hint: string; test: (c: Country) => boolean }[] = [
  { id: 'eu', label: 'EU-Mitglieder', hint: 'Die 27 Länder der Europäischen Union', test: (c) => EU.has(c.iso2) },
  { id: 'euro', label: 'Zahlen mit Euro', hint: 'Der Euro ist (eine) Landeswährung – auch außerhalb der EU', test: (c) => c.currencies.some((x) => x.code === 'EUR') },
  { id: 'landlocked', label: 'Binnenländer', hint: 'Kein Zugang zum Meer', test: (c) => c.landlocked },
  { id: 'island', label: 'Inselstaaten', hint: 'Keine Landgrenze zu einem anderen Land', test: (c) => !c.borders.length && !c.landlocked },
];

export const LANG_MODES: { id: LangMode; label: string; hint: string }[] = [
  { id: 'official', label: 'Amtssprache', hint: 'Die Sprache ist (eine der) landesweiten Amtssprachen.' },
  { id: 'only', label: 'Einzige Amtssprache', hint: 'Die Sprache ist die einzige landesweite Amtssprache.' },
  { id: 'spoken', label: 'Wird gesprochen', hint: 'Amtssprache, regionale Amtssprache oder im Land weit verbreitet.' },
];

export const PRESETS: { id: string; label: string; flag: string; filters: Partial<Filters> }[] = [
  { id: 'all', label: 'Alle Länder', flag: '', filters: { lang: '', continents: [] } },
  { id: 'es', label: 'Spanisch', flag: 'ES', filters: { lang: 'es', langMode: 'official', continents: [] } },
  { id: 'en', label: 'Englisch', flag: 'GB', filters: { lang: 'en', langMode: 'official', continents: [] } },
  { id: 'fr', label: 'Französisch', flag: 'FR', filters: { lang: 'fr', langMode: 'official', continents: [] } },
  { id: 'de', label: 'Deutsch', flag: 'DE', filters: { lang: 'de', langMode: 'official', continents: [] } },
  { id: 'pt', label: 'Portugiesisch', flag: 'PT', filters: { lang: 'pt', langMode: 'official', continents: [] } },
  { id: 'ar', label: 'Arabisch', flag: 'SA', filters: { lang: 'ar', langMode: 'official', continents: [] } },
];

export function matchesLanguage(c: Country, lang: string, mode: LangMode): boolean {
  const { official, regional, spoken } = c.languages;
  switch (mode) {
    case 'official':
      return official.includes(lang);
    case 'only':
      return official.length === 1 && official[0] === lang;
    case 'spoken':
      return official.includes(lang) || regional.includes(lang) || spoken.includes(lang);
  }
}

export function applyFilters(list: Country[], f: Filters): Country[] {
  return list.filter(
    (c) =>
      (f.includeSpecial || c.status === 'un') &&
      (!f.continents.length || c.continents.some((k) => f.continents.includes(k))) &&
      (!f.group || Boolean(GROUPS.find((g) => g.id === f.group)?.test(c))) &&
      (!f.lang || matchesLanguage(c, f.lang, f.langMode)),
  );
}

export function isFiltered(f: Filters): boolean {
  return Boolean(f.lang) || f.continents.length > 0 || !f.includeSpecial || Boolean(f.group);
}

export function describeFilters(f: Filters): string {
  const parts: string[] = [];
  if (f.lang) {
    const name = LANGUAGES[f.lang]?.de ?? f.lang;
    const mode = f.langMode === 'official' ? 'Amtssprache' : f.langMode === 'only' ? 'einzige Amtssprache' : 'gesprochen';
    parts.push(`${name} (${mode})`);
  }
  if (f.group) parts.push(GROUPS.find((g) => g.id === f.group)?.label ?? '');
  if (f.continents.length) parts.push(f.continents.map((k) => CONTINENT_LABEL[k]).join(', '));
  if (!f.includeSpecial) parts.push('nur UN-Mitglieder');
  return parts.join(' · ') || 'Alle Länder';
}
