import { useState } from 'react';
import { useTheme, type ThemeChoice } from '../../../shared/theme';
import { LANG_LABEL } from '../lib/data';
import type { Lang } from '../lib/types';
import { useApp } from '../state';
import Sheet from './Sheet';

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings, resetProgress, progress, isMobile } = useApp();
  const [theme, setTheme] = useTheme();
  const [confirmReset, setConfirmReset] = useState(false);
  const learned = Object.values(progress).filter((p) => p.box >= 3).length;

  return (
    <Sheet open={open} onClose={onClose} title="Einstellungen">
      <div className="space-y-7">
        <section className="space-y-3">
          <h3 className="label">Namen anzeigen auf</h3>
          <Segmented<Lang>
            label="Sprache der Länder- und Städtenamen"
            value={settings.nameLang}
            options={(['de', 'es', 'en'] as Lang[]).map((l) => ({ id: l, label: LANG_LABEL[l] }))}
            onChange={(v) => updateSettings({ nameLang: v })}
          />
          <label className="toggle-row">
            <input type="checkbox" checked={settings.showSecondary} onChange={(e) => updateSettings({ showSecondary: e.target.checked })} />
            <span>
              <b>Namen in den anderen Sprachen zusätzlich zeigen</b>
              <span className="block text-sm text-muted">z. B. „Spanien · España“ – praktisch für den Spanischunterricht.</span>
            </span>
          </label>
        </section>

        <section className="space-y-3">
          <h3 className="label">Karte</h3>
          {isMobile ? (
            <Segmented
              label="Position der Karte"
              value={settings.mapMobileSide}
              options={[
                { id: 'top', label: 'Oben' },
                { id: 'bottom', label: 'Unten' },
              ]}
              onChange={(v) => updateSettings({ mapMobileSide: v })}
            />
          ) : (
            <Segmented
              label="Position der Karte"
              value={settings.mapSide}
              options={[
                { id: 'left', label: 'Links' },
                { id: 'right', label: 'Rechts' },
              ]}
              onChange={(v) => updateSettings({ mapSide: v })}
            />
          )}
          <label className="toggle-row">
            <input type="checkbox" checked={settings.mapOpen} onChange={(e) => updateSettings({ mapOpen: e.target.checked })} />
            <span>
              <b>Karte ausgeklappt</b>
            </span>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={settings.mapBorders} onChange={(e) => updateSettings({ mapBorders: e.target.checked })} />
            <span>
              <b>Ländergrenzen einzeichnen</b>
            </span>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={settings.mapLabels} onChange={(e) => updateSettings({ mapLabels: e.target.checked })} />
            <span>
              <b>Ortsnamen auf der Karte</b>
              <span className="block text-sm text-muted">Beim Quiz werden sie automatisch versteckt.</span>
            </span>
          </label>
        </section>

        <section className="space-y-3">
          <h3 className="label">Design</h3>
          <Segmented<ThemeChoice>
            label="Farbschema"
            value={theme}
            options={[
              { id: 'system', label: 'Automatisch' },
              { id: 'light', label: 'Hell' },
              { id: 'dark', label: 'Dunkel' },
            ]}
            onChange={setTheme}
          />
        </section>

        <section className="space-y-3">
          <h3 className="label">Lernfortschritt</h3>
          <p className="text-sm text-muted">
            {learned} Karten sitzen schon sicher. Der Fortschritt wird nur auf diesem Gerät gespeichert.
          </p>
          {confirmReset ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary !bg-bad"
                onClick={() => {
                  resetProgress();
                  setConfirmReset(false);
                }}
              >
                Ja, alles zurücksetzen
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                Abbrechen
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(true)}>
              Fortschritt zurücksetzen
            </button>
          )}
        </section>

        <p className="text-xs leading-relaxed text-muted">
          Satellitenbilder: Esri, Maxar, Earthstar Geographics. Grenzen & Hauptstädte: Natural Earth. Flaggen: flag-icons. Länderdaten: world-countries (mledoze). Texte: KI-erstellt und gegengeprüft – Fehler gern melden.
        </p>
      </div>
    </Sheet>
  );
}
