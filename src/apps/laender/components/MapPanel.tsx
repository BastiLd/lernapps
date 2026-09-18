import { ArrowLeftRight, ArrowUpDown, ChevronDown, ChevronUp, Crosshair, Globe2, Map as MapIcon, Maximize2, Minimize2, PanelLeftClose, PanelRightClose, Tags } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useApp } from '../state';

const WorldMap = lazy(() => import('./WorldMap'));

const MIN_W = 340;
const MIN_MAIN = 420;

function clampWidth(w: number) {
  const max = Math.max(MIN_W, window.innerWidth - MIN_MAIN);
  return Math.round(Math.min(max, Math.max(MIN_W, w)));
}

function defaultWidth() {
  return clampWidth(Math.min(880, window.innerWidth * 0.46));
}

function MapBody() {
  return (
    <div className="map-body">
      <Suspense fallback={<div className="grid h-full place-items-center text-sm font-semibold text-white/80">Karte wird geladen …</div>}>
        <WorldMap />
      </Suspense>
    </div>
  );
}

function ToolButton({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: ReactNode }) {
  return (
    <button type="button" className="map-tool" onClick={onClick} aria-label={label} title={label} aria-pressed={pressed}>
      {children}
    </button>
  );
}

export default function MapPanel() {
  const { settings, updateSettings, isMobile, scene, setScene } = useApp();
  const open = settings.mapOpen;
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [winWidth, setWinWidth] = useState(() => window.innerWidth);
  const dragging = useRef(false);

  useEffect(() => {
    const onResize = () => setWinWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const width = dragWidth ?? (settings.mapWidth ? clampWidth(settings.mapWidth) : defaultWidth());
  void winWidth;

  const recenter = () => setScene({ ...scene, fly: scene.focus || scene.correct ? 'focus' : scene.set ? 'set' : 'world', flyKey: `re-${Date.now()}` });
  const world = () => setScene({ ...scene, fly: 'world', flyKey: `world-${Date.now()}` });
  const labelsHidden = Boolean(scene.hideLabels);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    setDragWidth(clampWidth(settings.mapSide === 'right' ? window.innerWidth - e.clientX : e.clientX));
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragWidth) updateSettings({ mapWidth: dragWidth });
    setDragWidth(null);
  };
  const onResizeKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 80 : 24;
    const grow = settings.mapSide === 'right' ? 'ArrowLeft' : 'ArrowRight';
    const shrink = settings.mapSide === 'right' ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === grow) updateSettings({ mapWidth: clampWidth(width + step) });
    else if (e.key === shrink) updateSettings({ mapWidth: clampWidth(width - step) });
    else return;
    e.preventDefault();
  };

  const tools = (
    <>
      <ToolButton label="Auf Markierung zentrieren" onClick={recenter}>
        <Crosshair size={18} />
      </ToolButton>
      <ToolButton label="Ganze Welt zeigen" onClick={world}>
        <Globe2 size={18} />
      </ToolButton>
      {!labelsHidden && (
        <ToolButton label={settings.mapLabels ? 'Ortsnamen ausblenden' : 'Ortsnamen einblenden'} pressed={settings.mapLabels} onClick={() => updateSettings({ mapLabels: !settings.mapLabels })}>
          <Tags size={18} />
        </ToolButton>
      )}
    </>
  );

  if (isMobile) {
    const side = settings.mapMobileSide;
    const bar = (
      <div className="map-sheet-bar">
        <button type="button" className="map-sheet-toggle" onClick={() => updateSettings({ mapOpen: !open })} aria-expanded={open}>
          <MapIcon size={18} />
          <span>{open ? 'Karte' : 'Karte anzeigen'}</span>
          {(side === 'top') === open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {open && (
          <div className="flex items-center gap-1">
            {tools}
            <ToolButton label={settings.mapMobileSize === 'full' ? 'Karte verkleinern' : 'Karte vergrößern'} onClick={() => updateSettings({ mapMobileSize: settings.mapMobileSize === 'full' ? 'half' : 'full' })}>
              {settings.mapMobileSize === 'full' ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </ToolButton>
            <ToolButton label={side === 'top' ? 'Karte nach unten verschieben' : 'Karte nach oben verschieben'} onClick={() => updateSettings({ mapMobileSide: side === 'top' ? 'bottom' : 'top' })}>
              <ArrowUpDown size={18} />
            </ToolButton>
          </div>
        )}
      </div>
    );
    return (
      <section className={`map-sheet ${open ? `is-open is-${settings.mapMobileSize}` : 'is-closed'}`} data-side={side} aria-label="Karte">
        {side === 'bottom' && bar}
        <MapBody />
        {side === 'top' && bar}
      </section>
    );
  }

  return (
    <aside className={`map-aside ${open ? 'is-open' : 'is-closed'}`} data-side={settings.mapSide} style={{ width: open ? width : 60 }} aria-label="Karte">
      {open ? (
        <>
          <div
            className="map-resize"
            role="separator"
            aria-orientation="vertical"
            aria-label="Kartenbreite ändern (Pfeiltasten)"
            aria-valuenow={width}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onResizeKey}
            onDoubleClick={() => updateSettings({ mapWidth: 0 })}
          />
          <div className="map-aside-head">
            <div className="flex items-center gap-2 font-bold">
              <MapIcon size={18} className="text-primary" /> Karte
            </div>
            <div className="flex items-center gap-1">
              {tools}
              <ToolButton label={settings.mapSide === 'right' ? 'Karte nach links' : 'Karte nach rechts'} onClick={() => updateSettings({ mapSide: settings.mapSide === 'right' ? 'left' : 'right' })}>
                <ArrowLeftRight size={18} />
              </ToolButton>
              <ToolButton label="Karte einklappen" onClick={() => updateSettings({ mapOpen: false })}>
                {settings.mapSide === 'right' ? <PanelRightClose size={18} /> : <PanelLeftClose size={18} />}
              </ToolButton>
            </div>
          </div>
        </>
      ) : (
        <button type="button" className="map-rail" onClick={() => updateSettings({ mapOpen: true })} aria-label="Karte ausklappen" title="Karte ausklappen">
          <MapIcon size={22} />
          <span>Karte</span>
        </button>
      )}
      <MapBody />
    </aside>
  );
}
