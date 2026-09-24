import { CloudDownload } from 'lucide-react';
import { useState } from 'react';

/**
 * Downloads the ~250 m country outlines once, so the map shows detailed borders even without internet
 * (the service worker keeps every downloaded file). Satellite images still need a connection.
 */
export default function OfflinePack() {
  const [state, setState] = useState<{ done: number; total: number; failed: number } | null>(null);
  const running = Boolean(state && state.done < state.total);

  const start = async () => {
    const { UNITS } = await import('../lib/detail');
    const urls = UNITS.mid.map((u) => `${import.meta.env.BASE_URL}geo/mid/${u.key}.json`);
    let done = 0;
    let failed = 0;
    setState({ done, total: urls.length, failed });
    let next = 0;
    const worker = async () => {
      while (next < urls.length) {
        const url = urls[next++];
        try {
          const r = await fetch(url);
          if (!r.ok) failed++;
          else await r.arrayBuffer();
        } catch {
          failed++;
        }
        done++;
        setState({ done, total: urls.length, failed });
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  };

  return (
    <div className="space-y-2">
      <button type="button" className="btn btn-ghost" onClick={() => void start()} disabled={running}>
        <CloudDownload size={18} /> {running ? 'Wird gespeichert …' : 'Genaue Grenzen für offline speichern (~11 MB)'}
      </button>
      {state && (
        <div>
          <div className="study-progress !mt-1" aria-hidden="true">
            <div style={{ width: `${(state.done / state.total) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted" role="status">
            {state.done < state.total ? `${state.done} von ${state.total} Dateien …` : state.failed ? `Fertig – ${state.failed} Dateien konnten nicht geladen werden (Internet prüfen).` : '✓ Gespeichert – die Karte zeigt jetzt auch offline genaue Umrisse.'}
          </p>
        </div>
      )}
    </div>
  );
}
