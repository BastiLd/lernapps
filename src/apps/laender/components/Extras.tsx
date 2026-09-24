import { useEffect, useState } from 'react';
import { BY_ISO, COUNTRIES } from '../lib/data';
import type { Lang } from '../lib/types';

// ------------------------------------------------------------------ local time

/** UTC offset of a time zone in minutes, e.g. 120 for "GMT+02:00". */
function offsetMinutes(timeZone: string, at: Date): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

const hours = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 2 });

/** Current time in the capital and the difference to Austria. */
export function LocalTime({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);
  let time: string;
  try {
    time = new Intl.DateTimeFormat('de-AT', { timeZone, hour: '2-digit', minute: '2-digit' }).format(now);
  } catch {
    return null; // unknown time zone in this browser
  }
  const day = new Intl.DateTimeFormat('de-AT', { timeZone, weekday: 'long' }).format(now);
  const own = offsetMinutes(timeZone, now);
  const diff = own - offsetMinutes('Europe/Vienna', now);
  const utc = `UTC${own >= 0 ? '+' : '−'}${hours.format(Math.abs(own) / 60)}`;
  const rel = diff === 0 ? 'gleiche Zeit wie in Österreich' : `${hours.format(Math.abs(diff) / 60)} Std. ${diff > 0 ? 'vor' : 'hinter'} Österreich`;
  return (
    <>
      <p className="fact-big tabular-nums">{time}</p>
      <p className="mt-0.5 text-sm text-muted">
        {day} · {utc} · {rel}
      </p>
    </>
  );
}

// ------------------------------------------------------------------ true size comparison

interface TrueShape {
  w: number;
  h: number;
  d: string;
  /** kilometres per unit */
  km: number;
}

let shapesPromise: Promise<Record<string, TrueShape>> | null = null;
const loadTrueShapes = () => (shapesPromise ??= import('../data/shapes-true.json').then((m) => m.default as unknown as Record<string, TrueShape>));

const ratio = new Intl.NumberFormat('de-AT', { maximumSignificantDigits: 2 });

/** Both countries drawn on top of each other at the same scale (equal-area projection). */
export function SizeCompare({ iso, lang }: { iso: string; lang: Lang }) {
  const [shapes, setShapes] = useState<Record<string, TrueShape> | null>(null);
  const [other, setOther] = useState(iso === 'AT' ? 'DE' : 'AT');
  useEffect(() => {
    let alive = true;
    loadTrueShapes().then((s) => alive && setShapes(s));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => setOther((o) => (o === iso ? (iso === 'AT' ? 'DE' : 'AT') : o)), [iso]);

  const a = shapes?.[iso];
  const b = shapes?.[other];
  const ca = BY_ISO.get(iso);
  const cb = BY_ISO.get(other);
  if (!ca || !cb) return null;

  let figure = <div className="compare-figure compare-figure--loading" />;
  if (a && b) {
    const [aw, ah, bw, bh] = [a.w * a.km, a.h * a.km, b.w * b.km, b.h * b.km];
    const W = Math.max(aw, bw) * 1.08;
    const H = Math.max(ah, bh) * 1.08;
    figure = (
      <svg className="compare-figure" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${ca.name[lang]} und ${cb.name[lang]} im selben Maßstab`}>
        <path className="compare-b" d={b.d} transform={`translate(${(W - bw) / 2} ${(H - bh) / 2}) scale(${b.km})`} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
        <path className="compare-a" d={a.d} transform={`translate(${(W - aw) / 2} ${(H - ah) / 2}) scale(${a.km})`} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  const r = ca.area / cb.area;
  const text = r >= 1 ? `${ca.name[lang]} ist ${ratio.format(r)}-mal so groß wie ${cb.name[lang]}.` : `${cb.name[lang]} ist ${ratio.format(1 / r)}-mal so groß wie ${ca.name[lang]}.`;

  return (
    <div className="compare">
      {figure}
      <div className="compare-side">
        <p className="compare-legend">
          <span>
            <i className="compare-dot compare-dot--a" /> {ca.name[lang]}
          </span>
          <span>
            <i className="compare-dot compare-dot--b" /> {cb.name[lang]}
          </span>
        </p>
        <p className="font-semibold">{text}</p>
        <label className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
          Vergleichen mit
          <select className="select" value={other} onChange={(e) => setOther(e.target.value)}>
            {COUNTRIES.filter((c) => c.iso2 !== iso)
              .slice()
              .sort((x, y) => x.name[lang].localeCompare(y.name[lang], lang))
              .map((c) => (
                <option key={c.iso2} value={c.iso2}>
                  {c.name[lang]}
                </option>
              ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-muted">Flächentreu gezeichnet – anders als auf der Weltkarte, wo Länder weit im Norden (Russland, Kanada) viel zu groß erscheinen.</p>
      </div>
    </div>
  );
}
