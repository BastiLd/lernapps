import { Check, Download, Share } from 'lucide-react';
import { useInstall } from './pwa';

/** "Install as app": the browser's own dialog where available, otherwise short instructions. */
export default function InstallApp() {
  const { installed, canPrompt, ios, install } = useInstall();
  if (installed)
    return (
      <p className="install-note">
        <Check size={16} /> Läuft als App auf diesem Gerät.
      </p>
    );
  if (canPrompt)
    return (
      <button type="button" className="btn btn-primary" onClick={() => void install()}>
        <Download size={18} /> Als App installieren
      </button>
    );
  if (ios)
    return (
      <p className="install-note">
        iPhone/iPad: in Safari auf <Share size={15} className="inline" /> <b>Teilen</b> tippen → <b>Zum Home-Bildschirm</b>.
      </p>
    );
  return (
    <p className="install-note">
      Im Browser-Menü <b>„App installieren“</b> bzw. <b>„Zum Startbildschirm hinzufügen“</b> wählen – dann startet die Seite wie eine App, auch offline.
    </p>
  );
}
