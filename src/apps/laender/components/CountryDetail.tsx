import { ArrowLeft, ChevronLeft, ChevronRight, Coins, Landmark, Languages, Lightbulb, MapPinned, Mountain, Music, Phone, Ruler, ScrollText, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { BY_ISO, CONTINENT_LABEL, formatArea, formatPopulation, LANG_LABEL, languageName, STATUS_LABEL } from '../lib/data';
import type { Country, Lang } from '../lib/types';
import { useApp } from '../state';
import Flag from './Flag';
import Silhouette from './Silhouette';
import SpeakButton from './Speak';

interface Props {
  country: Country;
  position?: { index: number; total: number };
  onSelect: (iso: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onBack?: () => void;
}

function Fact({ icon, title, children, wide, className = '' }: { icon: ReactNode; title: string; children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <div className={`fact ${wide ? 'fact--wide' : ''} ${className}`}>
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

const nf = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 1 });
const pf = new Intl.NumberFormat('de-AT', { maximumSignificantDigits: 2 });

const AUSTRIA_KM2 = 83879;
const VIENNA_KM2 = 414.9;

/** Makes an area imaginable: compared with Austria, or with Vienna for tiny countries. */
function compareArea(km2: number): string {
  if (km2 >= AUSTRIA_KM2) return `≈ ${nf.format(km2 / AUSTRIA_KM2)}× so groß wie Österreich`;
  if (km2 >= VIENNA_KM2 * 10) return `≈ ${pf.format((km2 / AUSTRIA_KM2) * 100)} % von Österreich`;
  if (km2 >= VIENNA_KM2) return `≈ ${nf.format(km2 / VIENNA_KM2)}× so groß wie Wien`;
  return `≈ ${pf.format((km2 / VIENNA_KM2) * 100)} % der Fläche von Wien`;
}

export default function CountryDetail({ country: c, position, onSelect, onPrev, onNext, onBack }: Props) {
  const { settings, filters, openMap, setScene, scene } = useApp();
  const lang = settings.nameLang;
  const status = STATUS_LABEL[c.status];
  const highlight = filters.lang;
  const density = c.population && c.area ? c.population.value / c.area : null;

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
        <div className="flex items-center gap-1.5">
          {position && (
            <span className="mr-1 text-sm font-semibold text-muted tabular-nums">
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

      <header className="detail-hero contours">
        <Silhouette iso={c.iso2} className="detail-shape" />
        <div className="detail-flag-wrap">
          <Flag iso={c.iso2} alt={`Flagge von ${c.name.de}`} className="detail-flag" eager />
        </div>
        <div className="min-w-0">
          <p className="label">
            {c.continents.map((k) => CONTINENT_LABEL[k]).join(' / ')}
            {c.continents.some((k) => CONTINENT_LABEL[k] === c.subregion) ? '' : ` · ${c.subregion}`}
          </p>
          <h2 id="detail-title" className="detail-title">
            {c.name[lang]}
            {lang === 'es' && <SpeakButton text={c.name.es} lang="es" />}
          </h2>
          {settings.showSecondary && (
            <p className="detail-names">
              {otherLangs(lang).map((l) => (
                <span key={l} className="detail-name">
                  <span className="lang-tag">{l.toUpperCase()}</span>
                  <span lang={l}>{c.name[l]}</span>
                  {l === 'es' && <SpeakButton text={c.name.es} lang="es" />}
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

      <div className="fact-grid">
        <Fact icon={<Landmark size={17} />} title="Hauptstadt" className="fact--capital">
          <p className="fact-big">
            {c.capital[lang]}
            {lang === 'es' && <SpeakButton text={c.capital.es} lang="es" />}
          </p>
          {settings.showSecondary && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-sm font-semibold text-muted">
              {otherLangs(lang)
                .map((l) => [l, c.capital[l]] as const)
                .filter(([, n], i, arr) => n !== c.capital[lang] && arr.findIndex(([, m]) => m === n) === i)
                .map(([l, n], i) => (
                  <span key={l} className="inline-flex items-center gap-1">
                    {i > 0 && ' · '}
                    <span lang={l}>{n}</span>
                    {l === 'es' && <SpeakButton text={n} lang="es" />}
                  </span>
                ))}
            </p>
          )}
          {c.otherCapitals.map((o) => (
            <p key={o.en} className="mt-1 text-sm">
              <b>{o[lang]}</b> <span className="text-muted">– {o.role}</span>
            </p>
          ))}
          {c.capitalNote && <p className="mt-2 text-sm leading-relaxed text-muted">{c.capitalNote}</p>}
        </Fact>

        {c.demonym && (
          <Fact icon={<UserRound size={17} />} title="Einwohner heißen">
            <p className="font-bold">
              {c.demonym.deM} / {c.demonym.deF}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-sm">
              <span className="lang-tag">ES</span>
              <b lang="es">{c.demonym.esM}</b>
              {c.demonym.esF !== c.demonym.esM && (
                <>
                  / <b lang="es">{c.demonym.esF}</b>
                </>
              )}
              <SpeakButton text={c.demonym.esM === c.demonym.esF ? c.demonym.esM : `${c.demonym.esM}, ${c.demonym.esF}`} lang="es" />
            </p>
          </Fact>
        )}

        <Fact icon={<Users size={17} />} title="Einwohner">
          <p className="fact-big">{c.population ? formatPopulation(c.population.value) : '–'}</p>
          <p className="mt-0.5 text-sm text-muted">
            {c.population ? `Stand ${c.population.year}` : ''}
            {density ? ` · ${nf.format(density)} pro km²` : ''}
          </p>
        </Fact>

        <Fact icon={<Ruler size={17} />} title="Fläche">
          <p className="fact-big">{formatArea(c.area)}</p>
          <p className="mt-0.5 text-sm text-muted">{compareArea(c.area)}</p>
        </Fact>

        {c.currencies.length > 0 && (
          <Fact icon={<Coins size={17} />} title="Währung">
            {c.currencies.map((cur) => (
              <p key={cur.code} className="font-bold">
                {cur.de}{' '}
                <span className="text-sm font-semibold text-muted">
                  {cur.symbol && cur.symbol !== cur.code ? `${cur.symbol} · ` : ''}
                  {cur.code}
                </span>
              </p>
            ))}
            <p className="mt-0.5 text-sm text-muted" lang="es">
              ES: {c.currencies.map((cur) => cur.es).join(', ')}
            </p>
          </Fact>
        )}

        {(c.phone || c.tld) && (
          <Fact icon={<Phone size={17} />} title="Vorwahl & Internet">
            {c.phone && <p className="font-bold tabular-nums">{c.phone}</p>}
            {c.tld && <p className="mt-0.5 text-sm text-muted">Internet-Endung {c.tld}</p>}
          </Fact>
        )}

        <Fact icon={<Languages size={17} />} title="Sprachen" wide>
          <div className="flex flex-wrap gap-1.5">
            {c.languages.official.map((code) => langChip(code, 'official'))}
            {c.languages.regional.map((code) => langChip(code, 'regional'))}
            {c.languages.spoken.map((code) => langChip(code, 'spoken'))}
          </div>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-muted">
            <span>
              <i className="legend-dot official" /> Amtssprache
            </span>
            {c.languages.regional.length > 0 && (
              <span>
                <i className="legend-dot regional" /> regional / anerkannt
              </span>
            )}
            {c.languages.spoken.length > 0 && (
              <span>
                <i className="legend-dot spoken" /> verbreitet
              </span>
            )}
          </p>
          {c.languageNote && <p className="mt-2 text-sm leading-relaxed text-muted">{c.languageNote}</p>}
        </Fact>

        <Fact icon={<Mountain size={17} />} title="Nachbarländer" wide>
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
        <div className="story-grid">
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
