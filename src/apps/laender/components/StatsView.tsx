import { Award, CalendarDays, Flame, Target, TrendingUp } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { heatColor } from '../lib/colors';
import { BY_ISO } from '../lib/data';
import { QTYPES } from '../lib/questions';
import { dayKey, useApp } from '../state';
import Flag from './Flag';

const WEEKS = 6;

function streakOf(days: Record<string, number>): number {
  let n = 0;
  const d = new Date();
  // Today may still be empty – the streak then counts up to yesterday.
  if (!days[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (days[dayKey(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export default function StatsView({ onSelect }: { onSelect: (iso: string) => void }) {
  const { progress, days, filtered, setScene, settings } = useApp();
  const lang = settings.nameLang;

  const stats = useMemo(() => {
    const entries = Object.entries(progress);
    let right = 0;
    let wrong = 0;
    const perCountry = new Map<string, { boxes: number[]; right: number; wrong: number }>();
    for (const [key, p] of entries) {
      right += p.right;
      wrong += p.wrong;
      const iso = key.split(':')[1];
      const c = perCountry.get(iso) ?? { boxes: [], right: 0, wrong: 0 };
      c.boxes.push(p.box);
      c.right += p.right;
      c.wrong += p.wrong;
      perCountry.set(iso, c);
    }
    const heat: Record<string, number> = {};
    for (const [iso, c] of perCountry) heat[iso] = c.boxes.reduce((a, b) => a + Math.min(5, b), 0) / (c.boxes.length * 5);
    const weakest = [...perCountry]
      .filter(([iso, c]) => BY_ISO.has(iso) && c.wrong > 0)
      .map(([iso, c]) => ({ iso, rate: c.right / (c.right + c.wrong), wrong: c.wrong }))
      .sort((a, b) => a.rate - b.rate || b.wrong - a.wrong)
      .slice(0, 8);
    const perType = QTYPES.map((t) => {
      const pool = filtered.filter((c) => t.available(c));
      let known = 0;
      let seen = 0;
      for (const c of pool) {
        const p = progress[`${t.id}:${c.iso2}`];
        if (!p) continue;
        seen++;
        if (p.box >= 3) known++;
      }
      return { ...t, total: pool.length, known, seen };
    });
    return {
      cards: entries.length,
      known: entries.filter(([, p]) => p.box >= 3).length,
      answers: right + wrong,
      rate: right + wrong ? Math.round((right / (right + wrong)) * 100) : 0,
      heat,
      weakest,
      perType,
      countries: perCountry.size,
    };
  }, [progress, filtered]);

  const streak = streakOf(days);
  const today = days[dayKey()] ?? 0;

  // Colour the map by how well each country is known.
  useEffect(() => {
    setScene({ heat: stats.heat, hoverNames: true, fly: 'world', flyKey: 'stats' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.heat]);

  const calendar = useMemo(() => {
    const cells: { key: string; n: number; future: boolean; label: string }[] = [];
    const start = new Date();
    const weekday = (start.getDay() + 6) % 7; // Monday = 0
    start.setDate(start.getDate() - weekday - (WEEKS - 1) * 7);
    const now = new Date();
    for (let i = 0; i < WEEKS * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = dayKey(d);
      cells.push({ key, n: days[key] ?? 0, future: d > now, label: d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' }) });
    }
    return cells;
  }, [days]);

  const level = (n: number) => (n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : n < 60 ? 3 : 4);

  return (
    <div className="stats">
      <header className="study-head">
        <div className="min-w-0">
          <p className="label">Fortschritt</p>
          <h2 className="study-title">So weit bist du</h2>
          <p className="mt-1 text-sm text-muted">Alles wird nur auf diesem Gerät gespeichert. Die Karte zeigt, welche Länder du schon gut kannst.</p>
        </div>
      </header>

      <div className="kpis">
        <div className="kpi kpi--streak">
          <Flame size={20} />
          <b>{streak}</b>
          <span>{streak === 1 ? 'Lerntag in Folge' : 'Lerntage in Folge'}</span>
        </div>
        <div className="kpi">
          <Award size={20} />
          <b>{stats.known}</b>
          <span>Karten sitzen sicher</span>
        </div>
        <div className="kpi">
          <Target size={20} />
          <b>{stats.rate}%</b>
          <span>richtig ({stats.answers} Antworten)</span>
        </div>
        <div className="kpi">
          <TrendingUp size={20} />
          <b>{today}</b>
          <span>Antworten heute</span>
        </div>
      </div>

      <section className="stats-card">
        <h3 className="stats-h">
          <CalendarDays size={17} /> Die letzten {WEEKS} Wochen
        </h3>
        <div className="calendar" role="img" aria-label={`Lernkalender: ${calendar.filter((c) => c.n).length} Lerntage in den letzten ${WEEKS} Wochen`}>
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
            <span key={d} className="calendar-wd">
              {d}
            </span>
          ))}
          {calendar.map((c) => (
            <span key={c.key} className={`calendar-cell lv-${level(c.n)} ${c.future ? 'is-future' : ''} ${c.key === dayKey() ? 'is-today' : ''}`} title={c.future ? '' : `${c.label}: ${c.n} Antworten`} />
          ))}
        </div>
      </section>

      <section className="stats-card">
        <h3 className="stats-h">Nach Fragetyp (aktueller Filter)</h3>
        <ul className="type-bars">
          {stats.perType.map((t) => (
            <li key={t.id}>
              <span className="type-bars-label">{t.label}</span>
              <span className="type-bars-track" aria-hidden="true">
                <span className="type-bars-seen" style={{ width: `${t.total ? (t.seen / t.total) * 100 : 0}%` }} />
                <span className="type-bars-known" style={{ width: `${t.total ? (t.known / t.total) * 100 : 0}%` }} />
              </span>
              <span className="type-bars-num tabular-nums">
                {t.known}/{t.total}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted">
          <span>
            <i className="legend-dot" style={{ background: 'var(--ok)' }} /> sitzt sicher
          </span>
          <span>
            <i className="legend-dot" style={{ background: 'var(--sun)' }} /> schon geübt
          </span>
        </p>
      </section>

      <section className="stats-card">
        <h3 className="stats-h">Hier hakt es noch</h3>
        {stats.weakest.length ? (
          <ul className="weak-list">
            {stats.weakest.map((w) => {
              const c = BY_ISO.get(w.iso)!;
              return (
                <li key={w.iso}>
                  <button type="button" className="weak-item" onClick={() => onSelect(w.iso)}>
                    <Flag iso={c.iso2} alt="" className="weak-flag" />
                    <span className="min-w-0 flex-1 text-left">
                      <b className="block truncate">{c.name[lang]}</b>
                      <span className="block truncate text-xs text-muted">
                        {c.capital[lang]} · {w.wrong}× falsch
                      </span>
                    </span>
                    <span className="weak-rate" style={{ background: heatColor(w.rate) }}>
                      {Math.round(w.rate * 100)}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">Noch keine Fehler gesammelt – starte ein Quiz oder die Karteikarten!</p>
        )}
      </section>
    </div>
  );
}
