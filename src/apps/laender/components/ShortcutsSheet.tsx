import Sheet from './Sheet';

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Überall',
    keys: [
      ['Strg + K  oder  /', 'Land suchen'],
      ['?', 'Diese Übersicht'],
      ['Esc', 'Fenster schließen'],
    ],
  },
  {
    title: 'Karteikarten',
    keys: [
      ['Leertaste', 'Karte umdrehen'],
      ['1  oder  ←', 'Nochmal'],
      ['2  oder  →', 'Gewusst'],
    ],
  },
  {
    title: 'Quiz',
    keys: [
      ['1 – 4', 'Antwort wählen'],
      ['Enter', 'Weiter / Eintippen prüfen'],
    ],
  },
];

export default function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Tastenkürzel">
      <div className="space-y-6">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="label mb-2">{g.title}</h3>
            <dl className="shortcut-list">
              {g.keys.map(([k, what]) => (
                <div key={k}>
                  <dt>
                    {k.split('  ').map((part, i) => (
                      <span key={i}>{/^(oder|\+)$/.test(part.trim()) ? <span className="px-1 text-muted">{part}</span> : <kbd>{part}</kbd>}</span>
                    ))}
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
