import { ArrowRight, CalendarCheck, Check, Flame, Keyboard, ListChecks, MapPinned, Play, RotateCcw, Target, Timer, Trophy, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { confetti, playTone } from '../../../shared/fx';
import { usePersistentState } from '../../../shared/storage';
import { dailyChallenge, DAILY_KEY, DAILY_QUESTIONS, type DailyLog } from '../lib/daily';
import { BY_ISO, COUNTRIES } from '../lib/data';
import { acceptedAnswers, answerText, genderOf, gradeTyped, isSpanishType, pickOptions, QTYPE_BY_ID, QTYPES, shuffle, type Gender, type Grade, type QType } from '../lib/questions';
import type { Country, Lang } from '../lib/types';
import { dialogOpen } from '../lib/ui';
import { cardKey, dayKey, useApp } from '../state';
import Flag from './Flag';
import { PromptVisual, questionText } from './Prompt';
import SpeakButton from './Speak';

interface Question {
  type: QType;
  iso: string;
  options: string[];
}

interface Answer {
  q: Question;
  picked: string | null;
  correct: boolean;
  typed?: string;
  grade?: Grade;
}

type AnswerMode = 'choice' | 'type';

interface Config {
  types: QType[];
  count: number;
  mode: AnswerMode;
  /** Seconds for a speed round ("Blitz"), 0 = normal quiz. */
  timer: number;
}

const COUNTS = [10, 20, 30, 0];
const TIMERS = [60, 120];

function makeQuestion(c: Country, type: QType, pool: Country[], lang: Lang, mode: AnswerMode): Question {
  const typed = mode === 'type' && QTYPE_BY_ID[type].typeable;
  return { type, iso: c.iso2, options: type === 'click' || typed ? [] : pickOptions(type, c, pool, lang).map((o) => o.iso2) };
}

function buildQuestions(pool: Country[], cfg: Config, lang: Lang, only?: Question[]): Question[] {
  if (only) return shuffle(only).map((q) => makeQuestion(BY_ISO.get(q.iso)!, q.type, pool, lang, cfg.mode));
  // A speed round needs enough questions for the whole time – go through the pool several times if it is small.
  const rounds = cfg.timer ? Math.max(1, Math.ceil(80 / Math.max(1, pool.length))) : 1;
  const list = Array.from({ length: rounds }, () => shuffle(pool)).flat();
  const n = cfg.timer ? list.length : cfg.count ? Math.min(cfg.count, pool.length) : pool.length;
  return list.slice(0, n).map((c) => {
    const types = cfg.types.filter((t) => QTYPE_BY_ID[t].available(c));
    const type = types[Math.floor(Math.random() * types.length)] ?? 'flag';
    return makeQuestion(c, type, pool, lang, cfg.mode);
  });
}

function OptionContent({ type, c, lang, gender }: { type: QType; c: Country; lang: Lang; gender: Gender }) {
  if (type === 'flag-rev') return <Flag iso={c.iso2} alt="" className="option-flag" eager />;
  // Sentences: all options in the gender the question asks for, so the ending alone doesn't give it away.
  return <span lang={isSpanishType(type) ? 'es' : undefined}>{answerText(type, c, lang, gender)}</span>;
}

function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.id)} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function QuizView() {
  const { filtered, settings, setScene, mapClickRef, recordAnswer, openMap } = useApp();
  const [cfg, setCfg] = usePersistentState<Config>('laender:quiz', { types: ['flag', 'capital', 'capital-rev', 'map'], count: 10, mode: 'choice', timer: 0 });
  const [records, setRecords] = usePersistentState<Record<string, number>>('laender:blitzBest', {});
  const [dailyLog, setDailyLog] = usePersistentState<DailyLog>(DAILY_KEY, {});
  /** Day of the running daily challenge (null: a normal quiz). */
  const [daily, setDaily] = useState<string | null>(null);
  const [phase, setPhase] = useState<'setup' | 'run' | 'done'>('setup');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [grade, setGrade] = useState<Grade | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [newRecord, setNewRecord] = useState(false);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const lang = settings.nameLang;
  const [runTimer, setRunTimer] = useState(0);
  // "Fehler üben" after a speed round is a normal quiz, so the running round keeps its own timer setting.
  const blitz = phase === 'setup' ? cfg.timer > 0 : runTimer > 0;

  const q = questions[idx];
  const target = q ? BY_ISO.get(q.iso) : undefined;
  const answered = picked !== null;
  const score = answers.filter((a) => a.correct).length;
  const typingNow = Boolean(q && !q.options.length && q.type !== 'click');
  const recordKey = `${phase === 'setup' ? cfg.timer : runTimer}:${[...cfg.types].sort().join(',')}:${cfg.mode}`;

  const start = useCallback(
    (only?: Question[], day?: string) => {
      if (!filtered.length && !day) return;
      setDaily(day ?? null);
      setQuestions(
        day
          ? dailyChallenge(day).map(({ iso, type }) => makeQuestion(BY_ISO.get(iso)!, type, COUNTRIES, lang, 'choice'))
          : buildQuestions(filtered, only ? { ...cfg, timer: 0 } : cfg, lang, only),
      );
      setIdx(0);
      setAnswers([]);
      setPicked(null);
      setTyped('');
      setGrade(null);
      setStreak(0);
      setBest(0);
      setNewRecord(false);
      setTimeLeft(only || day ? 0 : cfg.timer);
      setRunTimer(only || day ? 0 : cfg.timer);
      setPhase('run');
    },
    [filtered, cfg, lang],
  );

  const finish = useCallback(() => setPhase('done'), []);

  const answer = useCallback(
    (iso: string, typedText?: string, g?: Grade) => {
      if (!q || picked !== null) return;
      const correct = iso === q.iso;
      setPicked(iso);
      setAnswers((a) => [...a, { q, picked: iso, correct, typed: typedText, grade: g }]);
      setStreak((s) => {
        const next = correct ? s + 1 : 0;
        setBest((b) => Math.max(b, next));
        return next;
      });
      recordAnswer(cardKey(q.type, q.iso), correct);
      if (settings.sound) playTone(correct ? 'ok' : 'bad');
      if (!blitz || !correct) window.setTimeout(() => nextBtn.current?.focus(), 30);
    },
    [q, picked, recordAnswer, blitz, settings.sound],
  );

  const submitTyped = () => {
    if (!q || !target || answered) return;
    const res = gradeTyped(typed, acceptedAnswers(q.type, target, lang));
    setGrade(res.grade);
    answer(res.grade === 'wrong' ? '' : q.iso, typed, res.grade);
  };

  const next = useCallback(() => {
    if (idx + 1 >= questions.length) setPhase('done');
    else {
      setIdx((i) => i + 1);
      setPicked(null);
      setTyped('');
      setGrade(null);
    }
  }, [idx, questions.length]);

  // Speed round: right answers go on by themselves, a wrong one shows the solution briefly.
  useEffect(() => {
    if (!blitz || phase !== 'run' || !answered) return;
    const last = answers[answers.length - 1];
    const t = window.setTimeout(next, last?.correct ? 650 : 1600);
    return () => window.clearTimeout(t);
  }, [blitz, phase, answered, answers, next]);

  useEffect(() => {
    if (phase !== 'run' || !blitz || timeLeft <= 0) return;
    const t = window.setTimeout(() => {
      if (timeLeft <= 1) finish();
      setTimeLeft((s) => s - 1);
    }, 1000);
    return () => window.clearTimeout(t);
  }, [phase, blitz, timeLeft, finish]);

  // Finished: save records and the daily challenge, celebrate a great result.
  useEffect(() => {
    if (phase !== 'done' || !answers.length) return;
    let party = !blitz && score / answers.length >= 0.9;
    if (blitz && score > (records[recordKey] ?? 0)) {
      setRecords((r) => ({ ...r, [recordKey]: score }));
      setNewRecord(true);
      party = true;
    }
    if (daily) setDailyLog((l) => ({ ...l, [daily]: { score: Math.max(score, l[daily]?.score ?? 0), total: answers.length } }));
    if (party) {
      confetti();
      if (settings.sound) playTone('win');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase === 'run' && typingNow && !answered) window.setTimeout(() => input.current?.focus(), 30);
  }, [phase, idx, typingNow, answered]);

  // Map: question state before the answer, feedback afterwards.
  useEffect(() => {
    if (phase !== 'run' || !q) {
      const isAll = filtered.length === COUNTRIES.length;
      setScene({ set: phase === 'setup' && !isAll ? filtered.map((c) => c.iso2) : null, fly: 'none', flyKey: `quiz-${phase}`, hideLabels: false });
      return;
    }
    if (answered) {
      setScene({
        correct: q.iso,
        wrong: picked && picked !== q.iso ? picked : null,
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
      if (dialogOpen() || e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!answered && q && q.options.length && /^[1-4]$/.test(e.key)) answer(q.options[Number(e.key) - 1]);
      else if (answered && e.key === 'Enter' && !(e.target as HTMLElement).closest('button')) next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, answered, q, answer, next]);

  const poolInfo = useMemo(() => `${filtered.length} ${filtered.length === 1 ? 'Land' : 'Länder'} im Filter`, [filtered.length]);

  if (phase === 'setup') {
    const toggle = (t: QType) => setCfg((c) => ({ ...c, types: c.types.includes(t) ? (c.types.length > 1 ? c.types.filter((x) => x !== t) : c.types) : [...c.types, t] }));
    const lengthValue = cfg.timer ? `t${cfg.timer}` : `n${cfg.count}`;
    const typeableSelected = cfg.types.filter((t) => QTYPE_BY_ID[t].typeable).length;
    const record = records[recordKey];
    const todayDaily = dailyLog[dayKey()];
    return (
      <div className="study">
        <div className="daily-card">
          <div className="daily-icon">
            <CalendarCheck size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="label !text-current opacity-80">Tages-Challenge · {new Date().toLocaleDateString('de-AT', { day: 'numeric', month: 'long' })}</p>
            <p className="font-display text-lg font-extrabold leading-tight">{DAILY_QUESTIONS} Fragen aus aller Welt – jeden Tag neue, für alle gleich.</p>
            {todayDaily && (
              <p className="mt-1 text-sm font-semibold">
                ✓ Heute geschafft: {todayDaily.score} von {todayDaily.total} richtig
              </p>
            )}
          </div>
          <button type="button" className="btn btn-primary shrink-0" onClick={() => start(undefined, dayKey())}>
            <Play size={17} /> {todayDaily ? 'Nochmal' : 'Los'}
          </button>
        </div>

        <div className="quiz-setup card contours">
          <div className="quiz-setup-icon">
            <Trophy size={30} />
          </div>
          <h2 className="study-title">Quiz</h2>
          <p className="mt-1 text-muted">{poolInfo}. Die Fragen kommen aus deiner aktuellen Filterauswahl.</p>

          <h3 className="label mt-7">Fragetypen</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {QTYPES.map((t) => (
              <button key={t.id} type="button" className="chip" aria-pressed={cfg.types.includes(t.id)} onClick={() => toggle(t.id)} title={t.hint}>
                {t.needsMap && <MapPinned size={14} />}
                {t.label}
              </button>
            ))}
          </div>

          <h3 className="label mt-7">Antworten</h3>
          <div className="mt-2">
            <Segmented<AnswerMode>
              label="Wie antworten?"
              value={cfg.mode}
              onChange={(mode) => setCfg((c) => ({ ...c, mode }))}
              options={[
                {
                  id: 'choice',
                  label: (
                    <>
                      <ListChecks size={16} /> Auswählen
                    </>
                  ),
                },
                {
                  id: 'type',
                  label: (
                    <>
                      <Keyboard size={16} /> Eintippen
                    </>
                  ),
                },
              ]}
            />
          </div>
          {cfg.mode === 'type' && (
            <p className="mt-2 text-sm text-muted">
              {typeableSelected
                ? 'Kleine Tippfehler und fehlende Akzente zählen als richtig – du siehst aber die korrekte Schreibweise.'
                : 'Die gewählten Fragetypen lassen sich nicht eintippen – sie bleiben Auswahlfragen.'}
            </p>
          )}

          <h3 className="label mt-7">Länge</h3>
          <div className="mt-2">
            <Segmented<string>
              label="Anzahl Fragen oder Zeit"
              value={lengthValue}
              onChange={(v) => setCfg((c) => (v.startsWith('t') ? { ...c, timer: Number(v.slice(1)) } : { ...c, timer: 0, count: Number(v.slice(1)) }))}
              options={[
                ...COUNTS.map((n) => ({ id: `n${n}`, label: n ? String(n) : `Alle (${filtered.length})` })),
                ...TIMERS.map((t) => ({
                  id: `t${t}`,
                  label: (
                    <>
                      <Zap size={15} /> {t} s
                    </>
                  ),
                })),
              ]}
            />
          </div>
          {blitz && (
            <p className="mt-2 text-sm text-muted">
              Blitzrunde: So viele richtige Antworten wie möglich in {cfg.timer} Sekunden.{record ? ` Dein Rekord: ${record}.` : ''}
            </p>
          )}

          <button type="button" className="btn btn-primary btn-lg mt-8 w-full sm:w-auto" onClick={() => start()} disabled={!filtered.length}>
            <Play size={18} /> {blitz ? 'Blitzrunde starten' : 'Quiz starten'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const pctValue = Math.round((score / Math.max(1, answers.length)) * 100);
    const mistakes = answers.filter((a) => !a.correct);
    const message = daily
      ? score === answers.length
        ? 'Tages-Challenge perfekt gelöst! 🏆'
        : `Tages-Challenge geschafft – morgen gibt's neue Fragen! 📅`
      : blitz
      ? newRecord
        ? 'Neuer Rekord! 🏆'
        : score >= 15
          ? 'Blitzschnell! ⚡'
          : 'Gut gemacht – nochmal? 💪'
      : pctValue >= 90
        ? 'Überragend! 🏆'
        : pctValue >= 70
          ? 'Sehr gut! 🎉'
          : pctValue >= 50
            ? 'Gut gemacht – dranbleiben! 💪'
            : 'Übung macht den Meister – probier die Karteikarten! 📚';
    const spellingHints = answers.filter((a) => a.correct && (a.grade === 'accent' || a.grade === 'typo'));
    return (
      <div className="study">
        <div className="quiz-result card contours">
          <div className="result-ring" style={{ ['--p' as string]: `${blitz ? Math.min(100, (score / Math.max(1, records[recordKey] ?? score)) * 100) : pctValue}` }}>
            <span>{blitz ? score : `${pctValue}%`}</span>
          </div>
          <h2 className="mt-4 text-2xl font-extrabold">{message}</h2>
          <p className="mt-1 text-muted">
            {score} von {answers.length} richtig · beste Serie: {best}
            {blitz && records[recordKey] ? ` · Rekord: ${records[recordKey]}` : ''}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {mistakes.length > 0 && (
              <button type="button" className="btn btn-primary" onClick={() => start(mistakes.map((m) => m.q))}>
                <Target size={18} /> {mistakes.length} Fehler üben
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => start(undefined, daily ?? undefined)}>
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
                          {isSpanishType(m.q.type) ? ` · ${answerText(m.q.type, c, lang)}` : ''}
                          {m.typed ? ` · deine Antwort: „${m.typed}“` : ''}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {spellingHints.length > 0 && (
            <div className="mt-6 text-left">
              <h3 className="label">Richtig – aber achte auf die Schreibweise</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {spellingHints.map((a, i) => (
                  <li key={i} className="chip !cursor-default">
                    <span className="text-muted line-through">{a.typed}</span> → <b>{answerText(a.q.type, BY_ISO.get(a.q.iso)!, lang)}</b>
                  </li>
                ))}
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
  const solution = answerText(q.type, target, lang);

  return (
    <div className="study">
      <div className="quiz-head">
        {blitz ? (
          <span className={`quiz-timer ${timeLeft <= 10 ? 'is-low' : ''}`} role="timer" aria-live="off">
            <Timer size={17} /> {timeLeft} s
          </span>
        ) : (
          <span className="font-bold tabular-nums">
            Frage {idx + 1} / {questions.length}
          </span>
        )}
        <span className="flex items-center gap-4 text-sm font-bold">
          <span className="inline-flex items-center gap-1 text-ok">
            <Check size={16} /> {score}
          </span>
          <span className={`inline-flex items-center gap-1 ${streak >= 3 ? 'text-accent' : 'text-muted'}`} title="Serie">
            <Flame size={16} /> {streak}
          </span>
          <button type="button" className="text-muted hover:text-ink" onClick={() => (answers.length ? finish() : setPhase('setup'))}>
            Beenden
          </button>
        </span>
      </div>
      <div className="study-progress" aria-hidden="true">
        <div style={{ width: `${blitz ? (timeLeft / Math.max(1, runTimer)) * 100 : ((idx + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <div className="quiz-card card" key={idx}>
        <span className="flipcard-kind">{QTYPE_BY_ID[q.type].label}</span>
        <h2 className="quiz-question">{questionText(q.type, target, lang)}</h2>
        <div className="quiz-visual">
          <PromptVisual type={q.type} c={target} lang={lang} />
        </div>

        {q.type === 'click' ? (
          <div className="mt-4 text-center">
            {!answered && (
              <>
                <p className="font-semibold text-muted">Tippe das Land auf der Karte an.</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {!settings.mapOpen && (
                    <button type="button" className="btn btn-primary" onClick={openMap}>
                      <MapPinned size={18} /> Karte öffnen
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost" onClick={() => answer('')}>
                    Weiß ich nicht
                  </button>
                </div>
              </>
            )}
          </div>
        ) : typingNow ? (
          <form
            className="quiz-type"
            onSubmit={(e) => {
              e.preventDefault();
              if (answered) next();
              else submitTyped();
            }}
          >
            <input
              ref={input}
              className={`input quiz-type-input ${answered ? (correctNow ? 'is-correct' : 'is-wrong') : ''}`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              readOnly={answered}
              placeholder={isSpanishType(q.type) ? 'Auf Spanisch eintippen …' : 'Antwort eintippen …'}
              aria-label="Deine Antwort"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              lang={isSpanishType(q.type) ? 'es' : undefined}
            />
            {!answered && (
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary flex-1 sm:flex-none" disabled={!typed.trim()}>
                  <Check size={18} /> Prüfen
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => answer('', typed, 'wrong')}>
                  Weiß ich nicht
                </button>
              </div>
            )}
            {isSpanishType(q.type) ? (
              <div className="quiz-accents" aria-label="Sonderzeichen">
                {['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü'].map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    disabled={answered}
                    onClick={() => {
                      setTyped((t) => t + ch);
                      input.current?.focus();
                    }}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            ) : null}
          </form>
        ) : (
          <div className={`quiz-options ${q.type === 'flag-rev' ? 'is-flags' : ''}`}>
            {q.options.map((iso, i) => {
              const c = BY_ISO.get(iso)!;
              const state = !answered ? '' : iso === q.iso ? 'is-correct' : iso === picked ? 'is-wrong' : 'is-dim';
              return (
                <button key={iso} type="button" className={`quiz-option ${state}`} onClick={() => answer(iso)} disabled={answered} aria-label={q.type === 'flag-rev' ? `Flagge ${i + 1}` : undefined}>
                  <kbd>{i + 1}</kbd>
                  <OptionContent type={q.type} c={c} lang={lang} gender={genderOf(target)} />
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
              <p className="font-extrabold">
                {correctNow ? (grade === 'accent' ? 'Richtig – aber mit Akzent!' : grade === 'typo' ? 'Fast perfekt – richtig geschrieben:' : 'Richtig!') : picked ? 'Leider falsch.' : 'Kein Problem – so wär’s richtig:'}
              </p>
              <p className="text-sm">
                {!correctNow && q.type === 'click' && pickedCountry ? `Du hast ${pickedCountry.name[lang]} angetippt. ` : ''}
                {typingNow && (grade !== 'exact' || !correctNow) ? (
                  <>
                    <b lang={isSpanishType(q.type) ? 'es' : undefined}>{solution}</b>
                    {q.type === 'capital' ? ` · ${target.name[lang]}` : isSpanishType(q.type) ? (target.name.de !== solution ? ` · ${target.name.de}` : '') : ` · Hauptstadt ${target.capital[lang]}`}
                  </>
                ) : (
                  <>
                    <b>{target.name[lang]}</b> · Hauptstadt {target.capital[lang]}
                    {isSpanishType(q.type) ? ` · ${solution}` : ''}
                  </>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {(isSpanishType(q.type)) && <SpeakButton text={solution} lang="es" className="speak-btn--lg" />}
              {!blitz || !correctNow ? (
                <button ref={nextBtn} type="button" className="btn btn-primary" onClick={next}>
                  {idx + 1 >= questions.length ? 'Ergebnis' : 'Weiter'} <ArrowRight size={18} />
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
