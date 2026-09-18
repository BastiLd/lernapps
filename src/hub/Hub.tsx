import { ArrowRight, Moon, Plus, Sun, SunMoon, WifiOff } from 'lucide-react';
import { APPS } from '../shared/apps';
import { loadJSON } from '../shared/storage';
import { useTheme, type ThemeChoice } from '../shared/theme';

const PREVIEW_FLAGS = Object.values(
  import.meta.glob<string>('../apps/laender/data/flags/{ES,MX,AR,CO,PE,CL,CU,VE,JP,BR,ZA,FR}.svg', { eager: true, query: '?url', import: 'default' }),
);

function progressOf(key?: string) {
  if (!key) return null;
  const p = loadJSON<Record<string, { box: number }>>(key, {});
  const values = Object.values(p);
  return { known: values.filter((v) => v.box >= 3).length, seen: values.length };
}

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
          <img src={`${base}favicon.svg`} alt="" width={40} height={40} className="rounded-xl" />
          <span className="text-lg font-extrabold tracking-tight">Lernapps</span>
        </div>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => setTheme(NEXT_THEME[theme])} aria-label={THEME_LABEL[theme]} title={THEME_LABEL[theme]}>
          <ThemeIcon size={19} />
        </button>
      </header>

      <main className="hub-main">
        <section className="hub-hero">
          <p className="label">Deine Lern-Apps für die Schule</p>
          <h1>
            Lernen, das <span className="hub-grad">Spaß</span> macht.
          </h1>
          <p className="hub-lead">Kleine Apps zum Üben – am Handy und am Computer, auch offline. Wähle eine App und leg los.</p>
        </section>

        <section className="hub-grid" aria-label="Apps">
          {APPS.map((app) => {
            const prog = progressOf(app.progressKey);
            return (
              <a key={app.id} href={`${base}${app.path}`} className="hub-card">
                <div className="hub-card-art" style={{ background: app.gradient }} aria-hidden="true">
                  <div className="hub-flags">
                    {PREVIEW_FLAGS.map((url) => (
                      <span key={url} className="hub-flag" style={{ backgroundImage: `url(${url})` }} />
                    ))}
                  </div>
                </div>
                <div className="hub-card-body">
                  <div className="flex flex-wrap gap-1.5">
                    {app.tags.map((t) => (
                      <span key={t} className="hub-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                  <h2>{app.title}</h2>
                  <p>{app.description}</p>
                  <div className="hub-card-foot">
                    <span className="text-sm font-semibold text-muted">{prog && prog.seen ? `${prog.known} Karten sitzen sicher · ${prog.seen} geübt` : 'Noch nicht gestartet'}</span>
                    <span className="hub-go">
                      Öffnen <ArrowRight size={18} />
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
          <div className="hub-card hub-card-soon" aria-label="Weitere Apps folgen">
            <Plus size={28} />
            <p className="font-bold">Weitere Apps folgen</p>
            <p className="text-sm text-muted">z. B. Vokabeln, Mathe, Biologie …</p>
          </div>
        </section>

        <p className="hub-offline">
          <WifiOff size={16} /> Einmal geöffnet, funktionieren die Apps auch ohne Internet (nur die Satellitenbilder brauchen eine Verbindung).
        </p>
      </main>
    </div>
  );
}
