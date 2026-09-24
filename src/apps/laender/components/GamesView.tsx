import { ArrowRight, Crosshair, Flag as FlagIcon, Lightbulb, MapPin, RotateCcw, SkipForward, Timer, Trophy, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { confetti, playTone, type Tone } from '../../../shared/fx';
import { usePersistentState } from '../../../shared/storage';
import { BY_ISO, COUNTRIES } from '../lib/data';
import { describeFilters } from '../lib/filters';
import { shuffle } from '../lib/questions';
import type { Country } from '../lib/types';
import { useApp } from '../state';
import Flag from './Flag';

type Game = 'find' | 'where';

interface Records {
  find: Record<string, { pct: number; seconds: number }>;
  where: Record<string, number>;
}

const WHERE_ROUNDS = 10;
const MAX_POINTS = 5000;

/** Great-circle distance in km. */
function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** GeoGuessr-like: 5000 points on the spot, about half at 1000 km, almost nothing beyond 5000 km. */
const pointsFor = (km: number) => Math.round(MAX_POINTS * Math.exp(-km / 1500));

const nf = new Intl.NumberFormat('de-AT');
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function useElapsed(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef(0);
  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now() - seconds * 1000;
    const t = window.setInterval(() => setSeconds(Math.floor((Date.now() - startRef.current) / 1000)), 500);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  return [seconds, setSeconds] as const;
}

// ------------------------------------------------------------------ "Länder finden"
function FindGame({ pool, onExit, poolKey, records, setRecords, tone }: { pool: Country[]; poolKey: string; onExit: () => void; records: Records; setRecords: (f: (r: Records) => Records) => void; tone: (t: Tone) => void }) {
  const { settings, setScene, mapClickRef, openMap, updateSettings, isMobile } = useApp();
  const [order, setOrder] = useState(() => shuffle(pool).map((c) => c.iso2));
  const [idx, setIdx] = useState(0);
  const [tries, setTries] = useState(0);
  const [found, setFound] = useState<string[]>([]);
  const [missed, setMissed] = useState<string[]>([]);
  const [points, setPoints] = useState(0);
  const [wrongClicks, setWrongClicks] = useState(0);
  const [flash, setFlash] = useState<{ wrong?: string; reveal?: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const done = idx >= order.length;
  const [seconds, setSeconds] = useElapsed(!done);
  const lang = settings.nameLang;
  const target = BY_ISO.get(order[idx] ?? '');
  const isAll = pool.length === COUNTRIES.length;
  const pct = order.length ? Math.round((points / (order.length * 3)) * 100) : 0;
  const best = records.find[poolKey];

  useEffect(() => {
    openMap();
    if (isMobile) updateSettings({ mapMobileSize: 'full' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setScene({
      set: isAll ? null : order,
      found,
      missed,
      wrong: flash?.wrong ?? null,
      focus: flash?.reveal ?? null,
      clickable: done ? 'select' : 'answer',
      hideLabels: !done,
      hoverNames: done,
      fly: 'none',
      flyKey: 'find',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found, missed, flash, done]);

  useEffect(() => {
    setScene({ set: isAll ? null : order, found: [], missed: [], clickable: 'answer', hideLabels: true, fly: isAll ? 'world' : 'set', flyKey: `find-start-${order.join()}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  const next = useCallback(() => {
    setIdx((i) => i + 1);
    setTries(0);
  }, []);

  const click = useCallback(
    (iso: string) => {
      if (!target || flash?.reveal) return;
      if (iso === target.iso2) {
        const gained = 3 - tries;
        setPoints((p) => p + gained);
        setFound((f) => [...f, iso]);
        setFlash(null);
        setMessage(gained === 3 ? 'Richtig!' : 'Gefunden!');
        tone('ok');
        next();
        return;
      }
      if (found.includes(iso) || missed.includes(iso)) {
        setMessage(`${BY_ISO.get(iso)?.name[lang] ?? 'Das'} ist schon erledigt.`);
        return;
      }
      tone('bad');
      setWrongClicks((w) => w + 1);
      const clicked = BY_ISO.get(iso);
      if (tries >= 2) {
        // Third miss: show where it is, then go on.
        setMissed((m) => [...m, target.iso2]);
        setFlash({ reveal: target.iso2, wrong: iso });
        setMessage(`Das war ${clicked?.name[lang] ?? 'falsch'}. ${target.name[lang]} ist gelb markiert.`);
        window.setTimeout(() => {
          setFlash(null);
          next();
        }, 1800);
        return;
      }
      setTries((t) => t + 1);
      setFlash({ wrong: iso });
      setMessage(`Nein, das ist ${clicked?.name[lang] ?? 'ein anderes Land'}.`);
      window.setTimeout(() => setFlash((f) => (f?.wrong === iso && !f.reveal ? null : f)), 900);
    },
    [target, tries, found, missed, flash, lang, next, tone],
  );

  useEffect(() => {
    mapClickRef.current = done ? null : click;
    return () => {
      mapClickRef.current = null;
    };
  }, [mapClickRef, click, done]);

  const skip = () => {
    if (!target) return;
    setMissed((m) => [...m, target.iso2]);
    setFlash({ reveal: target.iso2 });
    setMessage(`${target.name[lang]} ist gelb markiert.`);
    window.setTimeout(() => {
      setFlash(null);
      next();
    }, 1500);
  };

  // Finished: save the record, celebrate a good result.
  useEffect(() => {
    if (!done) return;
    if (pct >= 90) {
      confetti();
      tone('win');
    }
    const better = !best || pct > best.pct || (pct === best.pct && seconds < best.seconds);
    if (better) setRecords((r) => ({ ...r, find: { ...r.find, [poolKey]: { pct, seconds } } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const restart = () => {
    setOrder(shuffle(pool).map((c) => c.iso2));
    setIdx(0);
    setTries(0);
    setFound([]);
    setMissed([]);
    setPoints(0);
    setWrongClicks(0);
    setFlash(null);
    setMessage(null);
    setSeconds(0);
  };

  if (done) {
    return (
      <div className="game-card card contours">
        <div className="result-ring" style={{ ['--p' as string]: pct }}>
          <span>{pct}%</span>
        </div>
        <h2 className="mt-4 text-2xl font-extrabold">{pct === 100 ? 'Perfekt – alle auf Anhieb! 🏆' : pct >= 75 ? 'Stark gemacht! 🎉' : 'Geschafft – nochmal? 💪'}</h2>
        <p className="mt-1 text-muted">
          {found.length} von {order.length} gefunden · {wrongClicks} Fehlklicks · Zeit {clock(seconds)}
          {best ? ` · Rekord: ${best.pct}% in ${clock(best.seconds)}` : ''}
        </p>
        <p className="mt-1 text-sm text-muted">Die Karte zeigt jetzt alle Länder – fahr mit der Maus darüber für die Namen.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={restart}>
            <RotateCcw size={18} /> Nochmal
          </button>
          <button type="button" className="btn btn-ghost" onClick={onExit}>
            Andere Spiele
          </button>
        </div>
        {missed.length > 0 && (
          <div className="mt-6 text-left">
            <h3 className="label">Diese musst du dir noch merken</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {missed.map((iso) => (
                <span key={iso} className="chip !cursor-default">
                  <Flag iso={iso} alt="" className="!h-4 !w-auto rounded-[3px]" /> {BY_ISO.get(iso)?.name[lang]}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="game-run">
      <div className="quiz-head">
        <span className="font-bold tabular-nums">
          {idx + 1} / {order.length}
        </span>
        <span className="flex items-center gap-4 text-sm font-bold">
          <span className="inline-flex items-center gap-1 text-muted">
            <Timer size={16} /> {clock(seconds)}
          </span>
          <span className="inline-flex items-center gap-1 text-ok">{found.length} ✓</span>
          <span className="inline-flex items-center gap-1 text-bad">{wrongClicks} ✗</span>
          <button type="button" className="text-muted hover:text-ink" onClick={onExit} aria-label="Spiel beenden">
            <X size={18} />
          </button>
        </span>
      </div>
      <div className="study-progress" aria-hidden="true">
        <div style={{ width: `${(idx / order.length) * 100}%` }} />
      </div>
      <div className="game-target card">
        <p className="label">Finde auf der Karte</p>
        <div className="game-target-name">
          {target && <Flag iso={target.iso2} alt="" className="game-target-flag" eager />}
          <span>{target?.name[lang]}</span>
        </div>
        <p className={`game-message ${flash?.wrong ? 'is-bad' : ''}`} role="status">
          {message ?? (tries ? `Noch ${3 - tries} Versuch${3 - tries === 1 ? '' : 'e'}` : 'Tippe das Land auf der Karte an. Kleine Länder sind als Punkte markiert.')}
        </p>
        <button type="button" className="btn btn-ghost mt-3" onClick={skip} disabled={Boolean(flash?.reveal)}>
          <SkipForward size={17} /> Zeigen & weiter
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ "Wo liegt …?"
interface Round {
  iso: string;
  guess: [number, number] | null;
  km: number | null;
  points: number;
  hint: boolean;
}

function WhereGame({ pool, onExit, poolKey, records, setRecords, tone }: { pool: Country[]; poolKey: string; onExit: () => void; records: Records; setRecords: (f: (r: Records) => Records) => void; tone: (t: Tone) => void }) {
  const { settings, setScene, mapPointRef, openMap, updateSettings, isMobile } = useApp();
  const makeRounds = () => shuffle(pool).slice(0, Math.min(WHERE_ROUNDS, pool.length)).map((c): Round => ({ iso: c.iso2, guess: null, km: null, points: 0, hint: false }));
  const [rounds, setRounds] = useState<Round[]>(makeRounds);
  const [idx, setIdx] = useState(0);
  const lang = settings.nameLang;
  const round = rounds[idx];
  const target = round ? BY_ISO.get(round.iso) : undefined;
  const answered = Boolean(round?.guess);
  const done = idx >= rounds.length;
  const total = rounds.reduce((a, r) => a + r.points, 0);
  const best = records.where[poolKey];
  // Start every round with all capitals of the game in view – without marking any country.
  const view = useMemo((): [[number, number], [number, number]] => {
    const lats = pool.map((c) => c.capital.lat);
    const lngs = pool.map((c) => c.capital.lng);
    return [
      [Math.max(-60, Math.min(...lats) - 8), Math.min(...lngs) - 8],
      [Math.min(75, Math.max(...lats) + 8), Math.max(...lngs) + 8],
    ];
  }, [pool]);

  useEffect(() => {
    openMap();
    if (isMobile) updateSettings({ mapMobileSize: 'full' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (done || !target || !round) {
      setScene({ fly: 'world', flyKey: 'where-done', hoverNames: true, clickable: 'select' });
      return;
    }
    if (answered && round.guess) {
      setScene({
        guess: round.guess,
        truth: [target.capital.lat, target.capital.lng],
        truthLabel: `${target.capital[lang]} · ${nf.format(Math.round(round.km ?? 0))} km`,
        focus: target.iso2,
        hideLabels: false,
        fly: 'pins',
        flyKey: `where-${idx}-a`,
      });
    } else {
      setScene({ clickable: 'point', hideLabels: true, focus: round.hint ? target.iso2 : null, view, fly: round.hint ? 'focus' : 'view', flyKey: `where-${idx}-${round.hint}` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, answered, done, round?.hint]);

  useEffect(() => {
    mapPointRef.current =
      done || answered || !target
        ? null
        : (lat, lng) => {
            const km = distanceKm([lat, lng], [target.capital.lat, target.capital.lng]);
            const pts = Math.round(pointsFor(km) * (round.hint ? 0.5 : 1));
            tone(pts >= 4000 ? 'win' : pts >= 1500 ? 'ok' : 'bad');
            setRounds((rs) => rs.map((r, i) => (i === idx ? { ...r, guess: [lat, lng], km, points: pts } : r)));
          };
    return () => {
      mapPointRef.current = null;
    };
  }, [mapPointRef, done, answered, target, idx, round, tone]);

  useEffect(() => {
    if (!done) return;
    if (total > (best ?? 0)) setRecords((r) => ({ ...r, where: { ...r.where, [poolKey]: total } }));
    if (total >= rounds.length * MAX_POINTS * 0.7) {
      confetti();
      tone('win');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const restart = () => {
    setRounds(makeRounds());
    setIdx(0);
  };

  if (done) {
    const pct = Math.round((total / (rounds.length * MAX_POINTS)) * 100);
    return (
      <div className="game-card card contours">
        <div className="result-ring" style={{ ['--p' as string]: pct }}>
          <span className="!text-2xl">{nf.format(total)}</span>
        </div>
        <h2 className="mt-4 text-2xl font-extrabold">{pct >= 80 ? 'Weltklasse-Navigation! 🧭' : pct >= 55 ? 'Gut orientiert! 🎉' : 'Die Welt ist groß – nochmal? 🌍'}</h2>
        <p className="mt-1 text-muted">
          {nf.format(total)} von {nf.format(rounds.length * MAX_POINTS)} Punkten{best ? ` · Rekord: ${nf.format(Math.max(best, total))}` : ''}
        </p>
        <ul className="where-list">
          {rounds.map((r) => {
            const c = BY_ISO.get(r.iso)!;
            return (
              <li key={r.iso}>
                <Flag iso={c.iso2} alt="" className="!h-5 !w-auto rounded-[3px]" />
                <span className="min-w-0 flex-1 truncate">
                  <b>{c.capital[lang]}</b> <span className="text-muted">({c.name[lang]})</span>
                </span>
                <span className="text-sm text-muted tabular-nums">{r.km !== null ? `${nf.format(Math.round(r.km))} km` : '–'}</span>
                <b className="tabular-nums">{nf.format(r.points)}</b>
              </li>
            );
          })}
        </ul>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={restart}>
            <RotateCcw size={18} /> Nochmal
          </button>
          <button type="button" className="btn btn-ghost" onClick={onExit}>
            Andere Spiele
          </button>
        </div>
      </div>
    );
  }

  if (!round || !target) return null;
  return (
    <div className="game-run">
      <div className="quiz-head">
        <span className="font-bold tabular-nums">
          Runde {idx + 1} / {rounds.length}
        </span>
        <span className="flex items-center gap-4 text-sm font-bold">
          <span className="tabular-nums">{nf.format(total)} Punkte</span>
          <button type="button" className="text-muted hover:text-ink" onClick={onExit} aria-label="Spiel beenden">
            <X size={18} />
          </button>
        </span>
      </div>
      <div className="study-progress" aria-hidden="true">
        <div style={{ width: `${((idx + (answered ? 1 : 0)) / rounds.length) * 100}%` }} />
      </div>
      <div className="game-target card">
        <p className="label">Wo liegt die Hauptstadt …</p>
        <div className="game-target-name">
          <MapPin size={28} className="shrink-0 text-bad" />
          <span>{target.capital[lang]}</span>
        </div>
        <p className="text-sm font-semibold text-muted">{round.hint ? `Hinweis: in ${target.name[lang]} (gelb markiert) – nur halbe Punkte` : `Land: ${target.name[lang]}`}</p>
        {answered ? (
          <div className={`quiz-feedback ${round.points >= 2500 ? 'is-correct' : 'is-wrong'}`} role="status">
            <div className="min-w-0">
              <p className="font-extrabold">
                {nf.format(Math.round(round.km ?? 0))} km daneben · {nf.format(round.points)} Punkte
              </p>
              <p className="text-sm">
                {round.km !== null && round.km < 50 ? 'Volltreffer! 🎯' : round.km !== null && round.km < 300 ? 'Ganz nah dran!' : round.km !== null && round.km < 1000 ? 'Richtige Gegend.' : 'Das war weit weg – schau dir die Karte an.'}
              </p>
            </div>
            <button type="button" className="btn btn-primary shrink-0" onClick={() => setIdx((i) => i + 1)} autoFocus>
              {idx + 1 >= rounds.length ? 'Ergebnis' : 'Weiter'} <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <>
            <p className="game-message">
              <Crosshair size={16} className="mr-1 inline" /> Tippe auf der Karte auf die Stelle, wo du die Stadt vermutest.
            </p>
            {!round.hint && (
              <button type="button" className="btn btn-ghost mt-3" onClick={() => setRounds((rs) => rs.map((r, i) => (i === idx ? { ...r, hint: true } : r)))}>
                <Lightbulb size={17} /> Hinweis: Land zeigen (halbe Punkte)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ menu
export default function GamesView() {
  const { filtered, filters, settings, setScene } = useApp();
  const [game, setGame] = useState<Game | null>(null);
  const [records, setRecords] = usePersistentState<Records>('laender:games', { find: {}, where: {} });
  const poolKey = filtered.length === COUNTRIES.length ? 'alle' : describeFilters(filters);
  const tone = useCallback(
    (t: Tone) => {
      if (settings.sound) playTone(t);
    },
    [settings.sound],
  );
  const pool = useMemo(() => filtered, [filtered]);

  useEffect(() => {
    if (!game) setScene({ set: filtered.length < COUNTRIES.length ? filtered.map((c) => c.iso2) : null, fly: filtered.length < COUNTRIES.length ? 'set' : 'world', flyKey: 'games-menu', hoverNames: true, clickable: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  if (game) {
    const Play = game === 'find' ? FindGame : WhereGame;
    return (
      <div className="study">
        <Play pool={pool} poolKey={poolKey} records={records} setRecords={setRecords} tone={tone} onExit={() => setGame(null)} />
      </div>
    );
  }

  const findBest = records.find[poolKey];
  const whereBest = records.where[poolKey];
  return (
    <div className="study">
      <header className="study-head">
        <div className="min-w-0">
          <p className="label">Spiele</p>
          <h2 className="study-title">Spielend lernen</h2>
          <p className="mt-1 text-sm text-muted">
            Gespielt wird mit deiner Filterauswahl: <b>{describeFilters(filters)}</b> ({filtered.length} {filtered.length === 1 ? 'Land' : 'Länder'}).
          </p>
        </div>
      </header>
      <div className="game-grid">
        <button type="button" className="game-tile game-tile--find" onClick={() => setGame('find')} disabled={!filtered.length}>
          <span className="game-tile-icon">
            <FlagIcon size={26} />
          </span>
          <span className="game-tile-title">Länder finden</span>
          <span className="game-tile-text">Alle Länder nacheinander auf der Karte antippen. Drei Versuche pro Land – je weniger Fehlklicks, desto mehr Punkte.</span>
          <span className="game-tile-best">
            <Trophy size={15} /> {findBest ? `Rekord: ${findBest.pct}% in ${clock(findBest.seconds)}` : 'Noch kein Rekord'}
          </span>
        </button>
        <button type="button" className="game-tile game-tile--where" onClick={() => setGame('where')} disabled={!filtered.length}>
          <span className="game-tile-icon">
            <MapPin size={26} />
          </span>
          <span className="game-tile-title">Wo liegt …?</span>
          <span className="game-tile-text">Tippe die Hauptstadt auf der Karte an – je näher, desto mehr Punkte (bis zu 5000 pro Runde, wie bei GeoGuessr).</span>
          <span className="game-tile-best">
            <Trophy size={15} /> {whereBest ? `Rekord: ${nf.format(whereBest)} Punkte` : 'Noch kein Rekord'}
          </span>
        </button>
      </div>
      <p className="mt-4 text-sm text-muted">Tipp: Über „Filter“ kannst du z. B. nur Südamerika oder nur spanischsprachige Länder spielen.</p>
    </div>
  );
}
