// Registry of all learning apps shown on the hub page.
// To add a new app: create src/apps/<id>/ + <id>/index.html, add the entry to vite.config.ts and here.
export interface LernApp {
  id: string;
  path: string;
  title: string;
  description: string;
  tags: string[];
  gradient: string;
  progressKey?: string;
}

export const APPS: LernApp[] = [
  {
    id: 'laender',
    path: 'laender/',
    title: 'Länder der Welt',
    description: 'Flaggen, Hauptstädte, Sprachen, Geschichte und Kultur – mit Satellitenkarte, Karteikarten und Quiz. Mit Filter für spanischsprachige Länder.',
    tags: ['Geografie', 'Spanisch', '198 Länder'],
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #4f46e5 100%)',
    progressKey: 'laender:progress',
  },
];
