import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import { BY_ISO } from '../lib/data';
import type { Country } from '../lib/types';
import { useApp, type MapScene } from '../state';

const SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
const ATTRIBUTION = 'Bilder © <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics · Grenzen: Natural Earth';

const COLORS = {
  focus: '#fbbf24',
  set: '#22d3ee',
  correct: '#22c55e',
  wrong: '#f43f5e',
};

type Geo = Feature<Polygon | MultiPolygon, unknown>;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function ringArea(ring: Position[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
}

/** Bounds of the largest polygon — avoids zooming out to the whole world for countries with far-away islands. */
function mainBounds(geo: Geo | undefined, country: Country | null): L.LatLngBounds | null {
  let ring: Position[] | null = null;
  if (geo) {
    const polys = geo.geometry.type === 'Polygon' ? [geo.geometry.coordinates] : geo.geometry.coordinates;
    let best = -1;
    for (const p of polys) {
      const a = ringArea(p[0]);
      if (a > best) {
        best = a;
        ring = p[0];
      }
    }
  }
  const pts: L.LatLngExpression[] = ring ? ring.map(([lng, lat]) => [lat, lng] as [number, number]) : [];
  if (country) pts.push([country.capital.lat, country.capital.lng]);
  return pts.length ? L.latLngBounds(pts) : null;
}

function pinIcon(kind: 'capital' | 'other') {
  return L.divIcon({
    className: 'map-pin-wrap',
    html: `<span class="map-pin ${kind === 'other' ? 'map-pin--other' : ''}"><span></span></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

const pulseIcon = (color: string) =>
  L.divIcon({ className: 'map-pin-wrap', html: `<span class="map-pulse" style="--c:${color}"></span>`, iconSize: [44, 44], iconAnchor: [22, 22] });

export default function WorldMap() {
  const { scene, settings, mapClickRef } = useApp();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoLayer = useRef<L.GeoJSON | null>(null);
  const layers = useRef(new Map<string, L.Path>());
  const geos = useRef(new Map<string, Geo>());
  const markers = useRef<L.LayerGroup | null>(null);
  const labels = useRef<L.TileLayer | null>(null);
  const tip = useRef<L.Tooltip | null>(null);
  const sceneRef = useRef<MapScene>(scene);
  const settingsRef = useRef(settings);
  const hovered = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const offlineRef = useRef(offline);
  sceneRef.current = scene;
  settingsRef.current = settings;
  offlineRef.current = offline;

  // Leaflet event handlers are created once, so everything they read goes through refs.
  function styleFor(iso: string): L.PathOptions {
    const s = sceneRef.current;
    const offline = offlineRef.current;
    const inApp = BY_ISO.has(iso);
    const borders = settingsRef.current.mapBorders;
    const landFill = offline ? { fillColor: '#1e3a5f', fillOpacity: 0.85 } : { fillColor: '#000', fillOpacity: 0 };
    let style: L.PathOptions = {
      color: borders ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0)',
      weight: borders ? 0.8 : 0,
      fill: true,
      ...landFill,
    };
    if (s.set && inApp && s.set.includes(iso)) style = { ...style, color: '#a5f3fc', weight: 1.3, fillColor: COLORS.set, fillOpacity: offline ? 0.6 : 0.26 };
    if (s.focus === iso) style = { ...style, color: COLORS.focus, weight: 3, fillColor: COLORS.focus, fillOpacity: 0.22 };
    if (s.wrong === iso) style = { ...style, color: COLORS.wrong, weight: 3, fillColor: COLORS.wrong, fillOpacity: 0.4 };
    if (s.correct === iso) style = { ...style, color: COLORS.correct, weight: 3, fillColor: COLORS.correct, fillOpacity: 0.4 };
    if (hovered.current === iso && s.clickable && inApp) style = { ...style, weight: (style.weight ?? 1) + 1.5, fillOpacity: (style.fillOpacity ?? 0) + 0.12, color: style.color === 'rgba(255,255,255,0.55)' ? '#fff' : style.color };
    return style;
  }

  function restyle() {
    geoLayer.current?.setStyle((f) => styleFor(String((f as Geo).id)));
    const s = sceneRef.current;
    for (const iso of [s.focus, s.wrong, s.correct]) if (iso) layers.current.get(iso)?.bringToFront();
  }

  function fly(animate = !prefersReducedMotion()) {
    const map = mapRef.current;
    if (!map) return;
    const size = map.getSize();
    if (size.x < 50 || size.y < 50) return;
    const s = sceneRef.current;
    const pad = L.point(Math.min(60, size.x * 0.12), Math.min(60, size.y * 0.12));
    const opts = { padding: pad, animate, duration: 1.1 };
    if (s.fly === 'focus' && s.focus) {
      const c = BY_ISO.get(s.focus) ?? null;
      const b = mainBounds(geos.current.get(s.focus), c);
      if (b) {
        if (animate) map.flyToBounds(b, { ...opts, maxZoom: c?.small ? 8 : 6 });
        else map.fitBounds(b, { padding: pad, maxZoom: c?.small ? 8 : 6 });
      }
    } else if (s.fly === 'set' && s.set && s.set.length && s.set.length < 150) {
      let b: L.LatLngBounds | null = null;
      for (const iso of s.set) {
        const mb = mainBounds(geos.current.get(iso), BY_ISO.get(iso) ?? null);
        if (mb) b = b ? b.extend(mb) : mb;
      }
      if (b) {
        if (animate) map.flyToBounds(b, { ...opts, maxZoom: 5 });
        else map.fitBounds(b, { padding: pad, maxZoom: 5 });
      }
    } else if (s.fly === 'world' || (s.fly === 'set' && s.set)) {
      map.setView([22, 12], size.x < 500 ? 1.25 : 2, { animate });
    }
  }

  function rebuildMarkers() {
    const group = markers.current;
    const map = mapRef.current;
    if (!group || !map) return;
    group.clearLayers();
    const s = sceneRef.current;
    const ring = (iso: string | null | undefined, color: string) => {
      const c = iso ? BY_ISO.get(iso) : undefined;
      if (c?.small) L.marker([c.capital.lat, c.capital.lng], { icon: pulseIcon(color), interactive: false, keyboard: false }).addTo(group);
    };
    // Tiny states (Vatican, Monaco, Pacific islands …) are hard or impossible to hit as polygons,
    // so they get a clickable dot: for the filtered set, and for every country while answering on the map.
    const dots = s.clickable === 'answer' ? [...BY_ISO.keys()] : (s.set ?? []);
    for (const iso of dots) {
      const c = BY_ISO.get(iso);
      if (!c?.small || iso === s.focus || iso === s.correct || iso === s.wrong) continue;
      const inSet = Boolean(s.set?.includes(iso));
      L.circleMarker([c.capital.lat, c.capital.lng], {
        radius: inSet ? 5 : 4,
        color: inSet ? '#a5f3fc' : 'rgba(255,255,255,0.8)',
        weight: 2,
        fillColor: inSet ? COLORS.set : '#ffffff',
        fillOpacity: inSet ? 0.55 : 0.25,
        interactive: Boolean(s.clickable),
      })
        .on('click', () => mapClickRef.current?.(iso))
        .addTo(group);
    }
    ring(s.focus, COLORS.focus);
    ring(s.wrong, COLORS.wrong);
    ring(s.correct, COLORS.correct);

    const capCountry = s.capital ? BY_ISO.get(s.correct || s.focus || '') : undefined;
    if (capCountry) {
      const lang = settingsRef.current.nameLang;
      const m = L.marker([capCountry.capital.lat, capCountry.capital.lng], { icon: pinIcon('capital'), keyboard: false, interactive: false, zIndexOffset: 1000 }).addTo(group);
      if (s.capitalLabel) m.bindTooltip(capCountry.capital[lang], { permanent: true, direction: 'top', offset: [0, -12], className: 'map-label' });
      for (const o of capCountry.otherCapitals) {
        const om = L.marker([o.lat, o.lng], { icon: pinIcon('other'), keyboard: false, interactive: false }).addTo(group);
        if (s.capitalLabel) om.bindTooltip(`${o[lang]} · ${o.role}`, { permanent: true, direction: 'bottom', offset: [0, 10], className: 'map-label map-label--small' });
      }
    }
  }

  // Create the map once.
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const map = L.map(el, {
      zoomControl: false,
      worldCopyJump: true,
      minZoom: 1,
      maxZoom: 18,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 100,
      maxBounds: [
        [-85, -540],
        [85, 540],
      ],
      maxBoundsViscosity: 0.8,
    });
    mapRef.current = map;
    map.setView([22, 12], 2);
    map.attributionControl.setPrefix(false);
    L.control.zoom({ position: 'bottomright', zoomInTitle: 'Hineinzoomen', zoomOutTitle: 'Herauszoomen' }).addTo(map);
    L.tileLayer(SATELLITE, { maxZoom: 18, attribution: ATTRIBUTION }).addTo(map);
    map.createPane('labels');
    const lp = map.getPane('labels')!;
    lp.style.zIndex = '450';
    lp.style.pointerEvents = 'none';
    labels.current = L.tileLayer(LABELS, { pane: 'labels', maxZoom: 18 });
    markers.current = L.layerGroup().addTo(map);
    tip.current = L.tooltip({ direction: 'top', offset: [0, -10], className: 'map-label map-label--hover', opacity: 1 });

    let cancelled = false;
    import('../data/borders.json').then((mod) => {
      if (cancelled) return;
      const topo = mod.default as unknown as Parameters<typeof feature>[0];
      const fc = feature(topo, (topo as unknown as { objects: { countries: Parameters<typeof feature>[1] } }).objects.countries) as unknown as FeatureCollection<Polygon | MultiPolygon>;
      const renderer = L.canvas({ padding: 0.5, tolerance: 4 });
      // `renderer` is passed on to every polygon at runtime; the typings just don't list it.
      const layer = L.geoJSON(fc, {
        ...({ renderer } as L.GeoJSONOptions),
        style: (f) => styleFor(String((f as Geo).id)),
        onEachFeature: (f, lyr) => {
          const iso = String((f as Geo).id);
          geos.current.set(iso, f as Geo);
          layers.current.set(iso, lyr as L.Path);
          lyr.on('click', () => {
            if (sceneRef.current.clickable) mapClickRef.current?.(iso);
          });
          lyr.on('mousemove', (e: L.LeafletMouseEvent) => {
            const s = sceneRef.current;
            if (hovered.current !== iso) {
              const prev = hovered.current;
              hovered.current = iso;
              if (prev) (layers.current.get(prev) as L.Path | undefined)?.setStyle(styleFor(prev));
              (lyr as L.Path).setStyle(styleFor(iso));
            }
            const c = BY_ISO.get(iso);
            if (s.hoverNames && c && tip.current) tip.current.setLatLng(e.latlng).setContent(c.name[settingsRef.current.nameLang]).addTo(map);
          });
          lyr.on('mouseout', () => {
            if (hovered.current === iso) hovered.current = null;
            (lyr as L.Path).setStyle(styleFor(iso));
            tip.current?.remove();
          });
        },
      }).addTo(map);
      geoLayer.current = layer;
      setReady(true);
    });

    let lastSize = map.getSize();
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
      const size = map.getSize();
      // The map was hidden (collapsed) and is visible again: show the current scene without animation.
      if ((lastSize.x < 50 || lastSize.y < 50) && size.x >= 50 && size.y >= 50) fly(false);
      lastSize = size;
    });
    ro.observe(el);

    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      cancelled = true;
      ro.disconnect();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scene changes: colours + markers.
  useEffect(() => {
    if (!ready) return;
    restyle();
    rebuildMarkers();
    tip.current?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, scene, settings.mapBorders, settings.nameLang, offline]);

  // Camera moves only when a view asks for it (flyKey changes).
  useEffect(() => {
    if (ready) fly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, scene.flyKey]);

  // Place names overlay (never during quiz questions, it would give the answer away).
  useEffect(() => {
    const map = mapRef.current;
    const lbl = labels.current;
    if (!map || !lbl) return;
    const show = settings.mapLabels && !scene.hideLabels;
    if (show && !map.hasLayer(lbl)) lbl.addTo(map);
    if (!show && map.hasLayer(lbl)) lbl.remove();
  }, [settings.mapLabels, scene.hideLabels]);

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="world-map h-full w-full" role="application" aria-label="Interaktive Satellitenkarte" />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="rounded-full bg-black/55 px-4 py-2 text-sm font-semibold text-white backdrop-blur">Karte wird geladen …</span>
        </div>
      )}
      {offline && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] rounded-xl bg-black/65 px-3 py-2 text-center text-xs font-semibold text-white backdrop-blur">
          Offline – Satellitenbilder nicht verfügbar, Umrisse funktionieren trotzdem.
        </div>
      )}
    </div>
  );
}
