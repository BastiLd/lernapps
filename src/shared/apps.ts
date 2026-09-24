// Registry of all learning apps shown on the hub page.
// To add a new app: create src/apps/<id>/ + <id>/index.html, add the entry to vite.config.ts and here.
export interface LernApp {
  id: string;
  path: string;
  title: string;
  description: string;
  tags: string[];
  gradient: string;
  /** localStorage key of the learning progress (cards) and of the learning days (for the streak). */
  progressKey?: string;
  daysKey?: string;
  /** localStorage key of the daily challenge results (shown on the start page). */
  dailyKey?: string;
}

export const APPS: LernApp[] = [
  {
    id: 'laender',
    path: 'laender/',
    title: 'Länder der Welt',
    description: 'Flaggen, Hauptstädte, Umrisse, Sprachen, Geschichte und Kultur – mit genauer Satellitenkarte, Karteikarten, Quiz und Lernliste zum Ausdrucken.',
    tags: ['Geografie', 'Spanisch', '198 Länder', 'Spiele'],
    gradient: 'linear-gradient(135deg, #14b8a6 0%, #0b5f59 100%)',
    progressKey: 'laender:progress',
    daysKey: 'laender:days',
    dailyKey: 'laender:daily',
  },
];
