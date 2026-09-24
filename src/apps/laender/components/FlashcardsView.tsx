import { Check, RotateCcw, Shuffle, Sparkles, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePersistentState } from '../../../shared/storage';
import { BY_ISO, COUNTRIES } from '../lib/data';
import { QTYPES, shuffle, type QType } from '../lib/questions';
import { dialogOpen, isTyping } from '../lib/ui';
import { cardKey, useApp } from '../state';
import { AnswerVisual, PromptVisual, questionText } from './Prompt';

interface Card {
  key: string;
  type: QType;
  iso: string;
}

export default function FlashcardsView() {
  const { filtered, progress, recordAnswer, settings, setScene, openMap } = useApp();
  const [types, setTypes] = usePersistentState<QType[]>('laender:cardTypes', ['flag', 'capital']);
  const [queue, setQueue] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [round, setRound] = useState(0);
  const lang = settings.nameLang;

  const deck = useMemo<Card[]>(() => {
    const out: Card[] = [];
    for (const c of filtered)
      for (const t of types) if (QTYPES.find((q) => q.id === t)!.available(c)) out.push({ key: cardKey(t, c.iso2), type: t, iso: c.iso2 });
    return out;
  }, [filtered, types]);

  const stats = useMemo(() => {
    let fresh = 0;
    let learning = 0;
    let known = 0;
    for (const card of deck) {
      const p = progress[card.key];
      if (!p) fresh++;
      else if (p.box >= 3) known++;
      else learning++;
    }
    return { fresh, learning, known };
  }, [deck, progress]);

  // New session whenever the deck changes: weakest cards first, then random.
  useEffect(() => {
    const byBox = new Map<number, Card[]>();
    for (const card of shuffle(deck)) {
      const box = progress[card.key]?.box ?? 0;
      byBox.set(box, [...(byBox.get(box) ?? []), card]);
    }
    const order = [...byBox.keys()].sort((a, b) => a - b).flatMap((b) => byBox.get(b)!);
    setQueue(order);
    setFlipped(false);
    setDone(0);
    // progress is read once per session on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, round]);

  const current = queue[0];
  const country = current ? BY_ISO.get(current.iso) : undefined;

  useEffect(() => {
    if (!current || !country) {
      setScene({ set: filtered.length < COUNTRIES.length ? filtered.map((c) => c.iso2) : null, fly: 'none', flyKey: 'cards-empty', hideLabels: false });
      return;
    }
    if (flipped) {
      setScene({ focus: current.iso, capital: true, capitalLabel: true, fly: 'focus', flyKey: `card-${current.key}-back`, hoverNames: true });
    } else if (current.type === 'map') {
      setScene({ focus: current.iso, hideLabels: true, fly: 'focus', flyKey: `card-${current.key}-front` });
    } else {
      setScene({ hideLabels: true, fly: 'none', flyKey: `card-${current.key}-front` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.key, flipped]);

  const answer = useCallback(
    (knewIt: boolean) => {
      if (!current || !flipped) return;
      recordAnswer(current.key, knewIt);
      setFlipped(false);
      if (knewIt) {
        setDone((d) => d + 1);
        setQueue((q) => q.slice(1));
      } else {
        setQueue((q) => {
          const rest = q.slice(1);
          const pos = Math.min(3, rest.length);
          return [...rest.slice(0, pos), q[0], ...rest.slice(pos)];
        });
      }
    },
    [current, flipped, recordAnswer],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || dialogOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if ((e.target as HTMLElement).closest('button, a') && e.key === 'Enter') return;
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && (e.key === '1' || e.key === 'ArrowLeft')) answer(false);
      else if (flipped && (e.key === '2' || e.key === 'ArrowRight')) answer(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, flipped]);

  const toggleType = (t: QType) => setTypes((cur) => (cur.includes(t) ? (cur.length > 1 ? cur.filter((x) => x !== t) : cur) : [...cur, t]));
  const total = done + queue.length;

  const pct = deck.length ? Math.round((stats.known / deck.length) * 100) : 0;

  return (
    <div className="study">
      <header className="study-head">
        <div className="min-w-0">
          <p className="label">Karteikarten</p>
          <h2 className="study-title">Lernen mit System</h2>
          <p className="mt-1 text-sm text-muted">Was du nicht weißt, kommt bald wieder – was sitzt, seltener.</p>
        </div>
        <div className="mastery" style={{ ['--p' as string]: pct }} title={`${pct} % der Karten sitzen sicher`}>
          <span>{pct}%</span>
        </div>
      </header>

      <div className="study-setup">
        <p className="label mb-2">Kartentypen</p>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Kartentypen">
          {QTYPES.map((q) => (
            <button key={q.id} type="button" className="chip" aria-pressed={types.includes(q.id)} onClick={() => toggleType(q.id)} title={q.hint}>
              {q.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
          <span className="stat stat-new">{stats.fresh} neu</span>
          <span className="stat stat-learning">{stats.learning} am Lernen</span>
          <span className="stat stat-known">{stats.known} sicher</span>
          <button type="button" className="ml-auto inline-flex items-center gap-1.5 font-bold text-primary hover:underline" onClick={() => setRound((r) => r + 1)}>
            <Shuffle size={16} /> Neu mischen
          </button>
        </div>
      </div>

      {current && country ? (
        <>
          <div className="study-progress" aria-hidden="true">
            <div style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          <p className="mt-2 text-center text-sm font-semibold text-muted">
            {done} von {total} gelernt · noch {queue.length}
          </p>

          <div className="flipcard-stage">
            <div
              role="button"
              tabIndex={0}
              className={`flipcard ${flipped ? 'is-flipped' : ''}`}
              onClick={() => setFlipped((f) => !f)}
              aria-label={flipped ? 'Karte zurückdrehen' : 'Karte umdrehen und Antwort zeigen'}
            >
              <div className="flipcard-inner">
                <div className="flipcard-face flipcard-front">
                  <span className="flipcard-kind">{QTYPES.find((q) => q.id === current.type)!.label}</span>
                  <span className="flipcard-question">{questionText(current.type, country, lang)}</span>
                  <PromptVisual type={current.type} c={country} lang={lang} />
                  <span className="flipcard-tap">Tippen oder Leertaste zum Umdrehen</span>
                </div>
                <div className="flipcard-face flipcard-back" aria-hidden={!flipped}>
                  <span className="flipcard-kind">Antwort</span>
                  <AnswerVisual type={current.type} c={country} lang={lang} />
                </div>
              </div>
            </div>
          </div>

          {current.type === 'map' && !flipped && !settings.mapOpen && (
            <button type="button" className="btn btn-ghost mx-auto mt-3 flex" onClick={openMap}>
              Karte öffnen
            </button>
          )}

          <div className="study-actions">
            {flipped ? (
              <>
                <button type="button" className="btn answer-btn answer-again" onClick={() => answer(false)}>
                  <Undo2 size={19} /> Nochmal <kbd>1</kbd>
                </button>
                <button type="button" className="btn answer-btn answer-known" onClick={() => answer(true)}>
                  <Check size={19} /> Gewusst <kbd>2</kbd>
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary answer-btn" onClick={() => setFlipped(true)}>
                <RotateCcw size={18} /> Antwort zeigen <kbd>Leertaste</kbd>
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="study-done card">
          <Sparkles size={40} className="mx-auto text-accent" />
          <h2 className="mt-3 text-2xl font-extrabold">{deck.length ? 'Geschafft – alle Karten durch!' : 'Keine Karten'}</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            {deck.length
              ? `Du hast ${done} Karten gelernt. ${stats.known} von ${deck.length} sitzen schon sicher.`
              : 'Mit dem aktuellen Filter gibt es keine Länder. Ändere den Filter oder wähle andere Kartentypen.'}
          </p>
          {deck.length > 0 && (
            <button type="button" className="btn btn-primary mt-5" onClick={() => setRound((r) => r + 1)}>
              <Shuffle size={18} /> Noch eine Runde
            </button>
          )}
        </div>
      )}
    </div>
  );
}
