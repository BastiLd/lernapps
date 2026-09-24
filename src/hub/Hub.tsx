import { ArrowRight, CalendarCheck, Flame, Gamepad2, Layers, Moon, Plus, Smartphone, Sun, SunMoon, Trophy, WifiOff } from 'lucide-react';
import InstallApp from '../shared/InstallApp';
import { APPS } from '../shared/apps';
import { loadJSON } from '../shared/storage';
import { useTheme, type ThemeChoice } from '../shared/theme';

const FLAGS = import.meta.glob<string>('../apps/laender/data/flags/{ES,MX,AR,CO,PE,CL,CU,VE,JP,BR,ZA,FR,EC,UY,BO,PY,GT,HN}.svg', { eager: true, query: '?url', import: 'default' });
const PREVIEW_FLAGS = Object.values(FLAGS);
const ES_FLAG = FLAGS['../apps/laender/data/flags/ES.svg'];

function progressOf(key?: string) {
  if (!key) return null;
  const p = loadJSON<Record<string, { box: number }>>(key, {});
  const values = Object.values(p);
  return { known: values.filter((v) => v.box >= 3).length, seen: values.length };
}

/** Learning days in a row (see the "Fortschritt" view of the country app). */
function streakOf(key?: string) {
  if (!key) return 0;
  const days = loadJSON<Record<string, number>>(key, {});
  const k = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const d = new Date();
  if (!days[k(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days[k(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const NEXT_THEME: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_LABEL: Record<ThemeChoice, string> = { system: 'Design: automatisch', light: 'Design: hell', dark: 'Design: dunkel' };

export default function Hub() {
  const [theme, setTheme] = useTheme();
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : SunMoon;
  const base = import.meta.env.BASE_URL;

  return (
    <div className="hub">
      <header className="hub-top">
        <div className="flex items-center gap-3">
          <img src={`${base}favicon.svg`} alt="" width={40} height={40} className="hub-logo" />
          <span className="font-display text-xl font-extrabold tracking-tight">Lernapps</span>
        </div>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => setTheme(NEXT_THEME[theme])} aria-label={THEME_LABEL[theme]} title={THEME_LABEL[theme]}>
          <ThemeIcon size={19} />
        </button>
      </header>

      <main className="hub-main">
        <section className="hub-hero contours">
          <p className="label">Deine Lern-Apps für die Schule</p>
          <h1>
            Lernen, das <span className="hub-mark">hängen bleibt</span>.
          </h1>
          <p className="hub-lead">Kleine Apps zum Üben – am Handy und am Computer, auch offline. Wähle eine App und leg los.</p>
        </section>

        <section className="hub-grid" aria-label="Apps">
          {APPS.map((app) => {
            const prog = progressOf(app.progressKey);
            const streak = streakOf(app.daysKey);
            const daily = app.dailyKey ? loadJSON<Record<string, { score: number; total: number }>>(app.dailyKey, {})[today()] : undefined;
            const href = `${base}${app.path}`;
            return (
              <article key={app.id} className="hub-card">
                <a href={href} className="hub-card-art" style={{ background: app.gradient }} aria-hidden="true" tabIndex={-1}>
                  <div className="hub-flags">
                    {PREVIEW_FLAGS.map((url) => (
                      <span key={url} className="hub-flag" style={{ backgroundImage: `url(${url})` }} />
                    ))}
                  </div>
                </a>
                <div className="hub-card-body">
                  <div className="flex flex-wrap gap-1.5">
                    {app.tags.map((t) => (
                      <span key={t} className="hub-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                  <h2>
                    <a href={href} className="hub-card-link">
                      {app.title}
                    </a>
                  </h2>
                  <p>{app.description}</p>

                  <div className="hub-quick">
                    <a href={`${href}?filter=es#/entdecken`} className="hub-quick-link">
                      <img src={ES_FLAG} alt="" className="hub-quick-flag" /> Spanischsprachige Länder
                    </a>
                    <a href={`${href}#/karteikarten`} className="hub-quick-link">
                      <Layers size={16} /> Karteikarten
                    </a>
                    <a href={`${href}#/quiz`} className="hub-quick-link">
                      <Trophy size={16} /> Quiz
                    </a>
                    <a href={`${href}#/spiele`} className="hub-quick-link">
                      <Gamepad2 size={16} /> Spiele
                    </a>
                    {app.dailyKey && (
                      <a href={`${href}#/quiz`} className={`hub-quick-link ${daily ? 'is-done' : 'is-open'}`}>
                        <CalendarCheck size={16} /> {daily ? `Tages-Challenge ✓ ${daily.score}/${daily.total}` : 'Tages-Challenge offen'}
                      </a>
                    )}
                  </div>

                  <div className="hub-card-foot">
                    <span className="text-sm font-semibold text-muted">
                      {prog && prog.seen ? (
                        <>
                          {streak > 0 && (
                            <span className="hub-streak">
                              <Flame size={15} /> {streak}
                            </span>
                          )}
                          {prog.known} Karten sitzen · {prog.seen} geübt
                        </>
                      ) : (
                        'Noch nicht gestartet'
                      )}
                    </span>
                    <a href={href} className="btn btn-primary">
                      Öffnen <ArrowRight size={18} />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
          <div className="hub-card hub-card-soon" aria-label="Weitere Apps folgen">
            <Plus size={28} />
            <p className="font-bold">Weitere Apps folgen</p>
            <p className="text-sm text-muted">z. B. Vokabeln, Mathe, Biologie …</p>
          </div>
        </section>

        <section className="hub-install card">
          <div className="hub-install-icon">
            <Smartphone size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold">Als App aufs Handy</h2>
            <p className="mt-1 text-sm text-muted">Installiert startet Lernapps wie eine normale App – mit eigenem Symbol, im Vollbild und auch ohne Internet.</p>
            <div className="mt-3">
              <InstallApp />
            </div>
          </div>
        </section>

        <p className="hub-offline">
          <WifiOff size={16} /> Einmal geöffnet, funktionieren die Apps auch ohne Internet (nur die Satellitenbilder brauchen eine Verbindung).
        </p>
      </main>
    </div>
  );
}
