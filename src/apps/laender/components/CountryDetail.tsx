import { ArrowLeft, ChevronLeft, ChevronRight, Landmark, Languages, Lightbulb, MapPinned, Mountain, Ruler, ScrollText, Users, UserRound, Music } from 'lucide-react';
import type { ReactNode } from 'react';
import { BY_ISO, CONTINENT_LABEL, formatArea, formatPopulation, LANG_LABEL, languageName, STATUS_LABEL } from '../lib/data';
import type { Country, Lang } from '../lib/types';
import { useApp } from '../state';
import Flag from './Flag';

interface Props {
  country: Country;
  position?: { index: number; total: number };
  onSelect: (iso: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onBack?: () => void;
}

function Fact({ icon, title, children, wide }: { icon: ReactNode; title: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`fact ${wide ? '@xl:col-span-2' : ''}`}>
      <div className="fact-head">
        {icon}
        <span>{title}</span>
      </div>
      <div className="fact-body">{children}</div>
    </div>
  );
}

function otherLangs(lang: Lang): Lang[] {
  return (['de', 'es', 'en'] as Lang[]).filter((l) => l !== lang);
}

export default function CountryDetail({ country: c, position, onSelect, onPrev, onNext, onBack }: Props) {
  const { settings, filters, openMap, setScene, scene } = useApp();
  const lang = settings.nameLang;
  const status = STATUS_LABEL[c.status];
  const highlight = filters.lang;

  const langChip = (code: string, kind: 'official' | 'regional' | 'spoken') => (
    <span key={`${kind}-${code}`} className={`lang-chip lang-${kind} ${code === highlight ? 'is-hit' : ''}`}>
      {languageName(code)}
    </span>
  );

  const showOnMap = () => {
    openMap();
    setScene({ ...scene, fly: 'focus', flyKey: `show-${c.iso2}-${Date.now()}` });
  };

  return (
    <article className="detail" aria-labelledby="detail-title">
      <div className="detail-toolbar">
        {onBack ? (
          <button type="button" className="btn btn-ghost btn-back" onClick={onBack}>
            <ArrowLeft size={18} /> Liste
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {position && (
            <span className="text-sm font-semibold text-muted tabular-nums">
              {position.index + 1} / {position.total}
            </span>
          )}
          <button type="button" className="btn btn-ghost btn-icon" onClick={onPrev} disabled={!onPrev} aria-label="Vorheriges Land">
            <ChevronLeft size={20} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onNext} disabled={!onNext} aria-label="Nächstes Land">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <header className="detail-hero">
        <div className="detail-flag-wrap">
          <Flag iso={c.iso2} alt={`Flagge von ${c.name.de}`} className="detail-flag" eager />
        </div>
        <div className="min-w-0">
          <p className="label">
            {c.continents.map((k) => CONTINENT_LABEL[k]).join(' / ')} · {c.subregion}
          </p>
          <h2 id="detail-title" className="mt-1 text-3xl font-extrabold tracking-tight @xl:text-4xl">
            {c.name[lang]}
          </h2>
          {settings.showSecondary && (
            <p className="mt-1 text-[0.95rem] font-semibold text-muted">
              {otherLangs(lang).map((l, i) => (
                <span key={l}>
                  {i > 0 && ' · '}
                  <span className="lang-tag">{l.toUpperCase()}</span> {c.name[l]}
                </span>
              ))}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {status && <span className="badge badge-accent">{status}</span>}
            {c.landlocked && <span className="badge">Binnenland</span>}
            {!c.borders.length && <span className="badge">Keine Landgrenzen</span>}
            <button type="button" className="badge badge-button" onClick={showOnMap}>
              <MapPinned size={14} /> Auf der Karte zeigen
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 @xl:grid-cols-2">
        <Fact icon={<Landmark size={18} />} title="Hauptstadt">
          <p className="text-xl font-extrabold">{c.capital[lang]}</p>
          {settings.showSecondary && (
            <p className="text-sm font-semibold text-muted">
              {otherLangs(lang)
                .map((l) => c.capital[l])
                .filter((n, i, arr) => n !== c.capital[lang] && arr.indexOf(n) === i)
                .join(' · ')}
            </p>
          )}
          {c.otherCapitals.map((o) => (
            <p key={o.en} className="mt-1 text-sm">
              <b>{o[lang]}</b> <span className="text-muted">– {o.role}</span>
            </p>
          ))}
          {c.capitalNote && <p className="mt-2 text-sm leading-relaxed text-muted">{c.capitalNote}</p>}
        </Fact>

        <Fact icon={<Languages size={18} />} title="Sprachen">
          <div className="flex flex-wrap gap-1.5">
            {c.languages.official.map((code) => langChip(code, 'official'))}
            {c.languages.regional.map((code) => langChip(code, 'regional'))}
            {c.languages.spoken.map((code) => langChip(code, 'spoken'))}
          </div>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-muted">
            <span><i className="legend-dot official" /> Amtssprache</span>
            {c.languages.regional.length > 0 && <span><i className="legend-dot regional" /> regional / anerkannt</span>}
            {c.languages.spoken.length > 0 && <span><i className="legend-dot spoken" /> verbreitet</span>}
          </p>
          {c.languageNote && <p className="mt-2 text-sm leading-relaxed text-muted">{c.languageNote}</p>}
        </Fact>

        {c.demonym && (
          <Fact icon={<UserRound size={18} />} title="Einwohner heißen">
            <p className="font-bold">
              {c.demonym.deM} / {c.demonym.deF}
            </p>
            <p className="mt-1 text-sm">
              <span className="lang-tag">ES</span> <b>{c.demonym.esM}</b>
              {c.demonym.esF !== c.demonym.esM && (
                <>
                  {' '}
                  / <b>{c.demonym.esF}</b>
                </>
              )}
            </p>
          </Fact>
        )}

        <Fact icon={<Users size={18} />} title="Einwohner & Fläche">
          <p className="font-bold">
            {c.population ? (
              <>
                ca. {formatPopulation(c.population.value)} <span className="text-sm font-semibold text-muted">({c.population.year})</span>
              </>
            ) : (
              '–'
            )}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <Ruler size={15} /> {formatArea(c.area)}
          </p>
        </Fact>

        <Fact icon={<Mountain size={18} />} title="Nachbarländer" wide>
          {c.borders.length ? (
            <div className="flex flex-wrap gap-1.5">
              {c.borders
                .map((iso) => BY_ISO.get(iso))
                .filter((n): n is Country => Boolean(n))
                .sort((a, b) => a.name[lang].localeCompare(b.name[lang], lang))
                .map((n) => (
                  <button key={n.iso2} type="button" className="neighbor" onClick={() => onSelect(n.iso2)}>
                    <Flag iso={n.iso2} alt="" className="!h-4 !w-auto rounded-[3px]" />
                    {n.name[lang]}
                  </button>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Keine Landgrenzen zu anderen Ländern.</p>
          )}
        </Fact>
      </div>

      {(c.history || c.culture) && (
        <div className="mt-6 grid gap-4 @4xl:grid-cols-2">
          {c.history && (
            <section className="story">
              <h3>
                <ScrollText size={18} /> Geschichte
              </h3>
              <p>{c.history}</p>
            </section>
          )}
          {c.culture && (
            <section className="story">
              <h3>
                <Music size={18} /> Kultur
              </h3>
              <p>{c.culture}</p>
            </section>
          )}
        </div>
      )}

      {c.funFact && (
        <aside className="funfact">
          <Lightbulb size={22} className="shrink-0" />
          <div>
            <p className="label !text-current opacity-80">Wusstest du?</p>
            <p className="mt-1 font-semibold leading-relaxed">{c.funFact}</p>
          </div>
        </aside>
      )}

      <p className="mt-6 text-xs text-muted">
        Namen: {(['de', 'es', 'en'] as Lang[]).map((l) => `${LANG_LABEL[l]}: ${c.name[l]}`).join(' · ')}
      </p>
    </article>
  );
}
