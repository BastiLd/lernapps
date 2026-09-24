import { COUNTRIES } from './data';
import { QTYPE_BY_ID, type QType } from './questions';

/** Result of the daily challenge per day ("2026-09-24" → { score, total }), stored under DAILY_KEY. */
export type DailyLog = Record<string, { score: number; total: number }>;
export const DAILY_KEY = 'laender:daily';
export const DAILY_QUESTIONS = 10;

const TYPES: QType[] = ['flag', 'capital', 'shape', 'capital-rev', 'name-es', 'map', 'sentence-es'];

/** Small seeded random generator (mulberry32) – the same day gives the same numbers on every device. */
function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (text: string) => [...text].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);

/** Today's challenge: 10 countries with question types – identical for everybody on the same day. */
export function dailyChallenge(day: string): { iso: string; type: QType }[] {
  const rnd = seeded(hash(`lernapps-${day}`));
  const pool = COUNTRIES.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, DAILY_QUESTIONS).map((c) => {
    const types = TYPES.filter((t) => QTYPE_BY_ID[t].available(c));
    return { iso: c.iso2, type: types[Math.floor(rnd() * types.length)] };
  });
}
