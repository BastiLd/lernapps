import { BY_ISO, COUNTRIES } from './data';
import type { Country, Lang } from './types';

export type QType = 'flag' | 'flag-rev' | 'capital' | 'capital-rev' | 'map' | 'click' | 'name-es' | 'demonym-es';

export interface QTypeInfo {
  id: QType;
  label: string;
  hint: string;
  needsMap: boolean;
  available: (c: Country) => boolean;
}

const always = () => true;

export const QTYPES: QTypeInfo[] = [
  { id: 'flag', label: 'Flagge → Land', hint: 'Zu welchem Land gehört die Flagge?', needsMap: false, available: always },
  { id: 'flag-rev', label: 'Land → Flagge', hint: 'Welche Flagge hat das Land?', needsMap: false, available: always },
  { id: 'capital', label: 'Land → Hauptstadt', hint: 'Wie heißt die Hauptstadt?', needsMap: false, available: always },
  { id: 'capital-rev', label: 'Hauptstadt → Land', hint: 'Von welchem Land ist das die Hauptstadt?', needsMap: false, available: always },
  { id: 'map', label: 'Karte → Land', hint: 'Welches Land ist auf der Karte markiert?', needsMap: true, available: always },
  { id: 'click', label: 'Auf Karte finden', hint: 'Wo liegt das Land? Tippe es auf der Karte an.', needsMap: true, available: always },
  { id: 'name-es', label: 'Name auf Spanisch', hint: 'Wie heißt das Land auf Spanisch?', needsMap: false, available: always },
  { id: 'demonym-es', label: 'Nationalität (Spanisch)', hint: 'Wie heißen die Einwohner auf Spanisch?', needsMap: false, available: (c) => Boolean(c.demonym) },
];

export const QTYPE_BY_ID = Object.fromEntries(QTYPES.map((q) => [q.id, q])) as Record<QType, QTypeInfo>;

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Text of the answer for a question type (what the learner has to know). */
export function answerText(type: QType, c: Country, lang: Lang): string {
  switch (type) {
    case 'capital':
      return c.capital[lang] + (c.otherCapitals.length ? ` (${c.otherCapitals.map((o) => o[lang]).join(', ')})` : '');
    case 'name-es':
      return c.name.es;
    case 'demonym-es':
      return c.demonym ? (c.demonym.esM === c.demonym.esF ? c.demonym.esM : `${c.demonym.esM} / ${c.demonym.esF}`) : '–';
    default:
      return c.name[lang];
  }
}

/** Value used to make sure the answer options are distinguishable. */
function optionKey(type: QType, c: Country, lang: Lang): string {
  return type === 'flag-rev' ? c.iso2 : answerText(type, c, lang).toLowerCase();
}

/**
 * Picks `n - 1` distractors for `target`, preferring countries from the same region
 * (harder, more useful) and from the current pool.
 */
export function pickOptions(type: QType, target: Country, pool: Country[], lang: Lang, n = 4): Country[] {
  const source = (pool.length >= n + 2 ? pool : COUNTRIES).filter((c) => c.iso2 !== target.iso2 && QTYPES.find((q) => q.id === type)!.available(c));
  const scored = shuffle(source).map((c) => {
    let score = Math.random();
    if (c.subregion === target.subregion) score += 1.2;
    else if (c.continents.some((k) => target.continents.includes(k))) score += 0.6;
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set([optionKey(type, target, lang)]);
  const picked: Country[] = [];
  for (const { c } of scored) {
    const key = optionKey(type, c, lang);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(c);
    if (picked.length === n - 1) break;
  }
  return shuffle([target, ...picked]);
}

export function countryOrNull(iso: string | null | undefined): Country | null {
  return iso ? (BY_ISO.get(iso) ?? null) : null;
}
