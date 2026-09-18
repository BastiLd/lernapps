import { ArrowRight, Check, Flame, MapPinned, Play, RotateCcw, Target, Trophy, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentState } from '../../../shared/storage';
import { BY_ISO, COUNTRIES } from '../lib/data';
import { answerText, pickOptions, QTYPE_BY_ID, QTYPES, shuffle, type QType } from '../lib/questions';
import type { Country } from '../lib/types';
import { cardKey, useApp } from '../state';
import Flag from './Flag';
import { PromptVisual, questionText } from './Prompt';

interface Question {
  type: QType;
  iso: string;
  options: string[];
}

interface Answer {
  q: Question;
  picked: string | null;
  correct: boolean;
}

interface Config {
  types: QType[];
  count: number;
}

const COUNTS = [10, 20, 30, 0];

function buildQuestions(pool: Country[], cfg: Config, lang: 'de' | 'es' | 'en', only?: Question[]): Question[] {
  if (only) return shuffle(only).map((q) => ({ ...q, options: q.type === 'click' ? [] : pickOptions(q.type, BY_ISO.get(q.iso)!, pool, lang).map((c) => c.iso2) }));
  const n = cfg.count ? Math.min(cfg.count, pool.length) : pool.length;
  return shuffle(pool)
    .slice(0, n)
    .map((c) => {
      const types = cfg.types.filter((t) => QTYPE_BY_ID[t].available(c));
      const type = types[Math.floor(Math.random() * types.length)] ?? 'flag';
      return { type, iso: c.iso2, options: type === 'click' ? [] : pickOptions(type, c, pool, lang).map((o) => o.iso2) };
    });
}

function OptionContent({ type, c, lang }: { type: QType; c: Country; lang: 'de' | 'es' | 'en' }) {
  if (type === 'flag-rev') return <Flag iso={c.iso2} alt="" className="option-flag" eager />;
  return <span>{answerText(type, c, lang)}</span>;
}

export default function QuizView() {
  const { filtered, settings, setScene, mapClickRef, recordAnswer, openMap } = useApp();
  const [cfg, setCfg] = usePersistentState<Config>('laender:quiz', { types: ['flag', 'capital', 'capital-rev', 'map'], count: 10 });
  const [phase, setPhase] = useState<'setup' | 'run' | 'done'>('setup');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const lang = settings.nameLang;

  const q = questions[idx];
  const target = q ? BY_ISO.get(q.iso) : undefined;
  const answered = picked !== null;
  const score = answers.filter((a) => a.correct).length;

  const start = useCallback(
    (only?: Question[]) => {
      if (!filtered.length) return;
      setQuestions(buildQuestions(filtered, cfg, lang, only));
      setIdx(0);
      setAnswers([]);
      setPicked(null);
      setStreak(0);
      setBest(0);
      setPhase('run');
    },
    [filtered, cfg, lang],
  );

  const answer = useCallback(
    (iso: string) => {
      if (!q || picked !== null) return;
      const correct = iso === q.iso;
      setPicked(iso);
      setAnswers((a) => [...a, { q, picked: iso, correct }]);
      setStreak((s) => {
        const next = correct ? s + 1 : 0;
        setBest((b) => Math.max(b, next));
        return next;
      });
      recordAnswer(cardKey(q.type, q.iso), correct);
      window.setTimeout(() => nextBtn.current?.focus(), 30);
    },
    [q, picked, recordAnswer],
  );

  const next = useCallback(() => {
    if (idx + 1 >= questions.length) setPhase('done');
    else {
      setIdx((i) => i + 1);
      setPicked(null);
    }
  }, [idx, questions.length]);

  // Map: question state before the answer, feedback afterwards.
  useEffect(() => {
    if (phase !== 'run' || !q) {
      setScene({ set: phase === 'setup' ? filtered.map((c) => c.iso2) : null, fly: 'none', flyKey: `quiz-${phase}`, hideLabels: false });
      return;
    }
    if (answered) {
      setScene({
        correct: q.iso,
        wrong: picked !== q.iso ? picked : null,
        capital: q.type === 'capital' || q.type === 'capital-rev',
        capitalLabel: true,
        hideLabels: false,
        fly: 'focus',
        focus: q.iso,
        flyKey: `quiz-${idx}-a`,
      });
    } else if (q.type === 'map') {
      setScene({ focus: q.iso, hideLabels: true, fly: 'focus', flyKey: `quiz-${idx}-q` });
    } else if (q.type === 'click') {
      const pool = filtered.length < COUNTRIES.length ? filtered.map((c) => c.iso2) : null;
      setScene({ hideLabels: true, clickable: 'answer', set: pool, fly: pool ? 'set' : 'world', flyKey: `quiz-${idx}-q` });
    } else {
      setScene({ hideLabels: true, fly: 'none', flyKey: `quiz-${idx}-q` });
    }
    if (!answered && QTYPE_BY_ID[q.type].needsMap) openMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx, answered]);

  useEffect(() => {
    mapClickRef.current = phase === 'run' && q?.type === 'click' && !answered ? (iso) => answer(iso) : null;
    return () => {
      mapClickRef.current = null;
    };
  }, [mapClickRef, phase, q, answered, answer]);

  useEffect(() => {
    if (phase !== 'run') return;
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('.sheet-root') || e.target instanceof HTMLInputElement) return;
      if (!answered && q && q.options.length && /^[1-4]$/.test(e.key)) answer(q.options[Number(e.key) - 1]);
      else if (answered && e.key === 'Enter' && !(e.target as HTMLElement).closest('button')) next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, answered, q, answer, next]);

  const poolInfo = useMemo(() => `${filtered.length} Länder im Filter`, [filtered.length]);

  if (phase === 'setup') {
    const toggle = (t: QType) => setCfg((c) => ({ ...c, types: c.types.includes(t) ? (c.types.length > 1 ? c.types.filter((x) => x !== t) : c.types) : [...c.types, t] }));
    return (
      <div className="study">
        <div className="quiz-setup card">
          <div className="quiz-setup-icon">
            <Trophy size={30} />
          </div>
          <h2 className="text-2xl font-extrabold">Quiz</h2>
          <p className="mt-1 text-muted">{poolInfo}. Die Fragen kommen aus deiner aktuellen Filterauswahl.</p>

          <h3 className="label mt-6">Fragetypen</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {QTYPES.map((t) => (
              <button key={t.id} type="button" className="chip" aria-pressed={cfg.types.includes(t.id)} onClick={() => toggle(t.id)} title={t.hint}>
                {t.needsMap && <MapPinned size={14} />}
                {t.label}
              </button>
            ))}
          </div>

          <h3 className="label mt-6">Anzahl Fragen</h3>
          <div className="segmented mt-2" role="radiogroup" aria-label="Anzahl Fragen">
            {COUNTS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={cfg.count === n} onClick={() => setCfg((c) => ({ ...c, count: n }))}>
                {n ? n : `Alle (${filtered.length})`}
              </button>
            ))}
          </div>

          <button type="button" className="btn btn-primary mt-7 w-full sm:w-auto" onClick={() => start()} disabled={!filtered.length}>
            <Play size={18} /> Quiz starten
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const pctValue = Math.round((score / Math.max(1, answers.length)) * 100);
    const mistakes = answers.filter((a) => !a.correct);
    const message = pctValue >= 90 ? 'Überragend! 🏆' : pctValue >= 70 ? 'Sehr gut! 🎉' : pctValue >= 50 ? 'Gut gemacht – dranbleiben! 💪' : 'Übung macht den Meister – probier die Karteikarten! 📚';
    return (
      <div className="study">
        <div className="quiz-result card">
          <div className="result-ring" style={{ ['--p' as string]: `${pctValue}` }}>
            <span>{pctValue}%</span>
          </div>
          <h2 className="mt-4 text-2xl font-extrabold">{message}</h2>
          <p className="mt-1 text-muted">
            {score} von {answers.length} richtig · beste Serie: {best}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {mistakes.length > 0 && (
              <button type="button" className="btn btn-primary" onClick={() => start(mistakes.map((m) => m.q))}>
                <Target size={18} /> {mistakes.length} Fehler üben
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => start()}>
              <RotateCcw size={18} /> Nochmal
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPhase('setup')}>
              Einstellungen
            </button>
          </div>
          {mistakes.length > 0 && (
            <div className="mt-8 text-left">
              <h3 className="label">Das solltest du dir merken</h3>
              <ul className="mt-2 divide-y divide-line">
                {mistakes.map((m, i) => {
                  const c = BY_ISO.get(m.q.iso)!;
                  return (
                    <li key={i} className="flex items-center gap-3 py-2.5">
                      <Flag iso={c.iso2} alt="" className="!h-6 !w-auto rounded" />
                      <span className="min-w-0 flex-1">
                        <b>{c.name[lang]}</b>
                        <span className="block text-sm text-muted">
                          Hauptstadt: {c.capital[lang]}
                          {m.q.type === 'name-es' || m.q.type === 'demonym-es' ? ` · ${answerText(m.q.type, c, lang)}` : ''}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!q || !target) return null;
  const correctNow = answered && picked === q.iso;
  const pickedCountry = picked ? BY_ISO.get(picked) : undefined;

  return (
    <div className="study">
      <div className="quiz-head">
        <span className="font-bold tabular-nums">
          Frage {idx + 1} / {questions.length}
        </span>
        <span className="flex items-center gap-4 text-sm font-bold">
          <span className="inline-flex items-center gap-1 text-ok">
            <Check size={16} /> {score}
          </span>
          <span className={`inline-flex items-center gap-1 ${streak >= 3 ? 'text-accent' : 'text-muted'}`} title="Serie">
            <Flame size={16} /> {streak}
          </span>
        </span>
      </div>
      <div className="study-progress" aria-hidden="true">
        <div style={{ width: `${((idx + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <div className="quiz-card card">
        <span className="label">{QTYPE_BY_ID[q.type].label}</span>
        <h2 className="quiz-question">{questionText(q.type, target, lang)}</h2>
        <div className="quiz-visual">
          <PromptVisual type={q.type} c={target} lang={lang} />
        </div>

        {q.type === 'click' ? (
          <div className="mt-4 text-center">
            {!answered && (
              <>
                <p className="font-semibold text-muted">Tippe das Land auf der Karte an.</p>
                {!settings.mapOpen && (
                  <button type="button" className="btn btn-primary mt-3" onClick={openMap}>
                    <MapPinned size={18} /> Karte öffnen
                  </button>
                )}
                <button type="button" className="btn btn-ghost mt-3 ml-2" onClick={() => answer('')}>
                  Weiß ich nicht
                </button>
              </>
            )}
          </div>
        ) : (
          <div className={`quiz-options ${q.type === 'flag-rev' ? 'is-flags' : ''}`}>
            {q.options.map((iso, i) => {
              const c = BY_ISO.get(iso)!;
              const state = !answered ? '' : iso === q.iso ? 'is-correct' : iso === picked ? 'is-wrong' : 'is-dim';
              return (
                <button key={iso} type="button" className={`quiz-option ${state}`} onClick={() => answer(iso)} disabled={answered} aria-label={q.type === 'flag-rev' ? `Flagge ${i + 1}` : undefined}>
                  <kbd>{i + 1}</kbd>
                  <OptionContent type={q.type} c={c} lang={lang} />
                  {answered && iso === q.iso && <Check size={18} className="ml-auto shrink-0" />}
                  {answered && iso === picked && iso !== q.iso && <X size={18} className="ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {answered && (
          <div className={`quiz-feedback ${correctNow ? 'is-correct' : 'is-wrong'}`} role="status">
            <div className="min-w-0">
              <p className="font-extrabold">{correctNow ? 'Richtig!' : picked ? 'Leider falsch.' : 'Kein Problem – so wär’s richtig:'}</p>
              <p className="text-sm">
                {!correctNow && q.type === 'click' && pickedCountry ? `Du hast ${pickedCountry.name[lang]} angetippt. ` : ''}
                <b>{target.name[lang]}</b> · Hauptstadt {target.capital[lang]}
                {q.type === 'name-es' || q.type === 'demonym-es' ? ` · ${answerText(q.type, target, lang)}` : ''}
              </p>
            </div>
            <button ref={nextBtn} type="button" className="btn btn-primary shrink-0" onClick={next}>
              {idx + 1 >= questions.length ? 'Ergebnis' : 'Weiter'} <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
