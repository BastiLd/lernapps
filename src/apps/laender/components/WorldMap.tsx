import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Position } from 'geojson';
import { useEffect, useRef, useState } from 'react';
import { heatColor, MAP_COLORS } from '../lib/colors';
import { BY_ISO } from '../lib/data';
import { detailLevelFor, loadUnit, UNITS, type Box, type DetailLevel, type DetailUnit, type Piece } from '../lib/detail';
import { loadOverview, type Geo } from '../lib/geo';
import type { Country, MapStyle } from '../lib/types';
import { useApp, type MapScene } from '../state';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const BORDERS_CREDIT = 'Grenzen: <a href="https://www.geoboundaries.org" target="_blank" rel="noopener">geoBoundaries</a> (CC BY 4.0)';

const BASEMAPS: Record<Exclude<MapStyle, 'blank'>, { url: string; maxNativeZoom: number; attribution: string }> = {
  satellite: { url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, maxNativeZoom: 18, attribution: 'Bilder © <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics' },
  terrain: { url: `${ESRI}/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}`, maxNativeZoom: 9, attribution: 'Relief © <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, USGS, NOAA' },
  streets: { url: `${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`, maxNativeZoom: 18, attribution: 'Karte © <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, HERE, Garmin, OpenStreetMap' },
};
const LABELS = `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`;

/** Land/water colours of the "blank map" (no images – like a school atlas, also works offline). */
const BLANK = {
  light: { water: '#b9d9ee', land: '#f4eddc', border: '#9c8f76' },
  dark: { water: '#0c2131', land: '#223140', border: '#566b80' },
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDarkTheme = () => document.documentElement.dataset.theme === 'dark';

type DrawCanvas = { _updatePoly(layer: L.Path & { options: { clipBox?: Box } }, closed?: boolean): void };
const canvasProto = L.Canvas.prototype as unknown as DrawCanvas;

/**
 * Canvas renderer that draws the 50 m tile pieces only inside their own square. The pieces reach a little
 * beyond the square (where they were cut), so the cut lines lie outside the drawn area and never show –
 * neighbouring tiles fit together seamlessly.
 */
const ClipCanvas = (L.Canvas as unknown as { extend(props: object): new (options?: L.RendererOptions) => L.Canvas }).extend({
  _updatePoly(this: L.Canvas & { _map: L.Map; _ctx: CanvasRenderingContext2D; _drawing: boolean }, layer: L.Path & { options: { clipBox?: Box } }, closed?: boolean) {
    const box = layer.options.clipBox;
    if (!box || !this._drawing) return canvasProto._updatePoly.call(this, layer, closed);
    const nw = this._map.latLngToLayerPoint([box[3], box[0]]);
    const se = this._map.latLngToLayerPoint([box[1], box[2]]);
    const ctx = this._ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(nw.x, nw.y, se.x - nw.x, se.y - nw.y);
    ctx.clip();
    canvasProto._updatePoly.call(this, layer, closed);
    ctx.restore();
  },
});

function ringArea(ring: Position[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
}

/** Bounds of the largest polygon – avoids zooming out to the whole world for countries with far-away islands. */
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

/** Does the box [w, s, e, n] intersect the view, also counting its copies one world to the left/right? */
function intersectsWrapped(view: L.LatLngBounds, [w, s, e, n]: Box): boolean {
  for (const dx of [0, -360, 360]) {
    if (w + dx <= view.getEast() && e + dx >= view.getWest() && s <= view.getNorth() && n >= view.getSouth()) return true;
  }
  return false;
}

function pinIcon(kind: 'capital' | 'other' | 'guess') {
  return L.divIcon({
    className: 'map-pin-wrap',
    html: `<span class="map-pin map-pin--${kind}"><span></span></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const pulseIcon = (color: string) =>
  L.divIcon({ className: 'map-pin-wrap', html: `<span class="map-pulse" style="--c:${color}"></span>`, iconSize: [46, 46], iconAnchor: [23, 23] });

type Styleable = L.Layer & { setStyle(style: L.PathOptions): unknown; bringToFront(): unknown };

interface LoadedUnit {
  key: string;
  layers: { iso: string; layer: Styleable }[];
}

export default function WorldMap() {
  const { scene, settings, mapClickRef, mapPointRef } = useApp();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const renderer = useRef<L.Canvas | null>(null);
  const baseTiles = useRef<L.TileLayer | null>(null);
  const labels = useRef<L.TileLayer | null>(null);
  const overviewLayers = useRef(new Map<string, L.Path>());
  const geos = useRef(new Map<string, Geo>());
  const detailGroup = useRef<L.LayerGroup | null>(null);
  // Detailed outlines: units (country regions or tiles) of the current level, and those of the previous
  // level, which stay on the map until the new level is complete (no flicker back to the coarse outline).
  const units = useRef(new Map<string, LoadedUnit>());
  const stale = useRef<LoadedUnit[]>([]);
  const byIso = useRef(new Map<string, Set<Styleable>>());
  const detailLevel = useRef<DetailLevel | null>(null);
  const pendingIsos = useRef(new Set<string>());
  const wanted = useRef(new Set<string>());
  const generation = useRef(0);
  const markers = useRef<L.LayerGroup | null>(null);
  const tip = useRef<L.Tooltip | null>(null);
  const sceneRef = useRef<MapScene>(scene);
  const settingsRef = useRef(settings);
  const hovered = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [detailBusy, setDetailBusy] = useState(false);
  const offlineRef = useRef(offline);
  sceneRef.current = scene;
  settingsRef.current = settings;
  offlineRef.current = offline;

  // Leaflet event handlers are created once, so everything they read goes through refs.
  const effectiveStyle = (): MapStyle => {
    const s = settingsRef.current.mapStyle;
    if (offlineRef.current) return 'blank';
    // The topographic map has place names printed on it – during questions that would give the answer away.
    if (s === 'streets' && sceneRef.current.hideLabels) return 'terrain';
    return s;
  };

  function styleFor(iso: string): L.PathOptions {
    const s = sceneRef.current;
    const mapStyle = effectiveStyle();
    const blank = mapStyle === 'blank' ? BLANK[isDarkTheme() ? 'dark' : 'light'] : null;
    const onImage = mapStyle === 'satellite';
    const inApp = BY_ISO.has(iso);
    const borders = settingsRef.current.mapBorders || Boolean(blank);
    const lineColor = blank ? blank.border : onImage ? 'rgba(255,255,255,0.6)' : 'rgba(30,30,30,0.5)';
    let style: L.PathOptions = {
      stroke: true,
      color: borders ? lineColor : 'rgba(0,0,0,0)',
      weight: borders ? (blank ? 0.9 : 0.8) : 0,
      fill: true,
      fillColor: blank ? blank.land : '#000',
      fillOpacity: blank ? 1 : 0,
      dashArray: undefined,
      interactive: true,
    };
    if (s.heat) {
      const v = s.heat[iso];
      if (v !== undefined) style = { ...style, fillColor: heatColor(v), fillOpacity: blank ? 0.85 : 0.5 };
      else if (inApp) style = { ...style, fillColor: blank ? blank.land : '#94a3b8', fillOpacity: blank ? 1 : 0.18 };
    }
    if (s.set && inApp && s.set.includes(iso)) style = { ...style, color: blank ? '#0f766e' : '#99f6e4', weight: 1.4, fillColor: MAP_COLORS.set, fillOpacity: blank ? 0.55 : 0.28 };
    if (s.found?.includes(iso)) style = { ...style, color: MAP_COLORS.correct, weight: 1.6, fillColor: MAP_COLORS.correct, fillOpacity: blank ? 0.7 : 0.42 };
    if (s.missed?.includes(iso)) style = { ...style, color: MAP_COLORS.wrong, weight: 1.6, fillColor: MAP_COLORS.wrong, fillOpacity: blank ? 0.7 : 0.42 };
    if (s.neighbors?.includes(iso)) style = { ...style, color: blank ? '#6741d9' : MAP_COLORS.neighbor, weight: 1.8, dashArray: '5 4', fillColor: MAP_COLORS.neighbor, fillOpacity: blank ? 0.35 : 0.1 };
    if (s.focus === iso) style = { ...style, color: MAP_COLORS.focus, weight: 3.2, dashArray: undefined, fillColor: MAP_COLORS.focus, fillOpacity: blank ? 0.75 : 0.2 };
    if (s.wrong === iso) style = { ...style, color: MAP_COLORS.wrong, weight: 3.2, dashArray: undefined, fillColor: MAP_COLORS.wrong, fillOpacity: blank ? 0.75 : 0.38 };
    if (s.correct === iso) style = { ...style, color: MAP_COLORS.correct, weight: 3.2, dashArray: undefined, fillColor: MAP_COLORS.correct, fillOpacity: blank ? 0.75 : 0.38 };
    if (hovered.current === iso && (s.clickable === 'select' || s.clickable === 'answer') && inApp)
      style = { ...style, weight: (style.weight ?? 1) + 1.6, fillOpacity: Math.min(1, (style.fillOpacity ?? 0) + 0.14), color: style.color === lineColor ? (blank ? '#15181e' : '#fff') : style.color };
    return style;
  }

  /** The overview polygon is hidden while the country is shown in detail (and nothing of it is still loading). */
  function overviewStyle(iso: string): L.PathOptions {
    if (byIso.current.get(iso)?.size && !pendingIsos.current.has(iso)) return { stroke: false, fill: false, interactive: false };
    return styleFor(iso);
  }

  function frontIsos() {
    const s = sceneRef.current;
    return [...(s.neighbors ?? []), s.focus, s.wrong, s.correct].filter((x): x is string => Boolean(x));
  }

  function restyle() {
    for (const [iso, lyr] of overviewLayers.current) lyr.setStyle(overviewStyle(iso));
    for (const [iso, set] of byIso.current) for (const lyr of set) lyr.setStyle(styleFor(iso));
    for (const iso of frontIsos()) {
      overviewLayers.current.get(iso)?.bringToFront();
      for (const lyr of byIso.current.get(iso) ?? []) lyr.bringToFront();
    }
    const map = mapRef.current;
    if (map) {
      const blank = effectiveStyle() === 'blank';
      map.getContainer().style.background = blank ? BLANK[isDarkTheme() ? 'dark' : 'light'].water : '';
      map.getContainer().classList.toggle('is-point-mode', sceneRef.current.clickable === 'point');
    }
  }

  /** Re-applies the style of one country (overview and detail). */
  function refresh(iso: string) {
    overviewLayers.current.get(iso)?.setStyle(overviewStyle(iso));
    for (const lyr of byIso.current.get(iso) ?? []) lyr.setStyle(styleFor(iso));
  }

  function bindEvents(iso: string, lyr: L.Layer) {
    const map = mapRef.current!;
    lyr.on('click', () => {
      const c = sceneRef.current.clickable;
      if (c === 'select' || c === 'answer') mapClickRef.current?.(iso);
    });
    lyr.on('mousemove', (e: L.LeafletMouseEvent) => {
      const s = sceneRef.current;
      if (hovered.current !== iso) {
        const prev = hovered.current;
        hovered.current = iso;
        if (prev) refresh(prev);
        refresh(iso);
      }
      const c = BY_ISO.get(iso);
      if (s.hoverNames && c && tip.current) tip.current.setLatLng(e.latlng).setContent(c.name[settingsRef.current.nameLang]).addTo(map);
    });
    lyr.on('mouseout', () => {
      if (hovered.current === iso) hovered.current = null;
      refresh(iso);
      tip.current?.remove();
    });
  }

  function addPiece(unit: LoadedUnit, piece: Piece) {
    const opts = { ...styleFor(piece.iso), renderer: renderer.current ?? undefined };
    let layer: Styleable;
    if ('geo' in piece) {
      layer = L.geoJSON(piece.geo, { ...({ renderer: renderer.current } as L.GeoJSONOptions), style: () => styleFor(piece.iso) });
      (layer as L.GeoJSON).eachLayer((l) => bindEvents(piece.iso, l));
    } else {
      layer = L.polygon(piece.rings, { ...opts, clipBox: piece.clip } as L.PolylineOptions);
      bindEvents(piece.iso, layer);
    }
    detailGroup.current!.addLayer(layer);
    unit.layers.push({ iso: piece.iso, layer });
    if (!byIso.current.has(piece.iso)) byIso.current.set(piece.iso, new Set());
    byIso.current.get(piece.iso)!.add(layer);
  }

  function removeUnit(unit: LoadedUnit) {
    for (const { iso, layer } of unit.layers) {
      detailGroup.current?.removeLayer(layer);
      byIso.current.get(iso)?.delete(layer);
    }
  }

  function clearStale() {
    for (const u of stale.current) removeUnit(u);
    stale.current = [];
  }

  /** Swaps the coarse overview for detailed outlines of everything in view (and back when zooming out). */
  function updateDetail() {
    const map = mapRef.current;
    if (!map || !detailGroup.current) return;
    const size = map.getSize();
    if (size.x < 50 || size.y < 50) return;
    const level = detailLevelFor(map.getZoom());
    if (level !== detailLevel.current) {
      if (level) stale.current.push(...units.current.values());
      else {
        clearStale();
        for (const u of units.current.values()) removeUnit(u);
      }
      units.current.clear();
      detailLevel.current = level;
    }
    const gen = ++generation.current;
    if (!level) {
      wanted.current.clear();
      pendingIsos.current.clear();
      setDetailBusy(false);
      restyle();
      return;
    }
    const view = map.getBounds().pad(0.25);
    const want = new Map<string, DetailUnit>();
    for (const u of UNITS[level]) if (intersectsWrapped(view, u.box)) want.set(u.key, u);
    wanted.current = new Set(want.keys());
    for (const [key, u] of units.current) {
      if (want.has(key)) continue;
      removeUnit(u);
      units.current.delete(key);
    }
    const pending = [...want.values()].filter((u) => !units.current.has(u.key));
    pendingIsos.current = new Set(pending.flatMap((u) => u.isos));
    const done = () => {
      clearStale();
      pendingIsos.current.clear();
      setDetailBusy(false);
      restyle();
    };
    if (!pending.length) return done();
    setDetailBusy(true);
    let left = pending.length;
    for (const u of pending) {
      loadUnit(level, u).then((pieces) => {
        if (pieces && detailLevel.current === level && wanted.current.has(u.key) && !units.current.has(u.key) && mapRef.current) {
          const unit: LoadedUnit = { key: u.key, layers: [] };
          for (const piece of pieces) addPiece(unit, piece);
          units.current.set(u.key, unit);
        }
        if (gen !== generation.current) return;
        if (--left === 0) done();
      });
    }
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
        const maxZoom = c?.small ? 9 : 7;
        if (animate) map.flyToBounds(b, { ...opts, maxZoom });
        else map.fitBounds(b, { padding: pad, maxZoom });
      }
    } else if (s.fly === 'view' && s.view) {
      if (animate) map.flyToBounds(s.view, { ...opts, maxZoom: 5 });
      else map.fitBounds(s.view, { padding: pad, maxZoom: 5 });
    } else if (s.fly === 'pins' && s.truth) {
      const b = L.latLngBounds([s.truth, s.guess ?? s.truth]);
      if (animate) map.flyToBounds(b, { ...opts, maxZoom: 6 });
      else map.fitBounds(b, { padding: pad, maxZoom: 6 });
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
      const done = s.found?.includes(iso) ? MAP_COLORS.correct : s.missed?.includes(iso) ? MAP_COLORS.wrong : null;
      L.circleMarker([c.capital.lat, c.capital.lng], {
        radius: inSet ? 5.5 : 4.5,
        color: done ?? (inSet ? '#99f6e4' : 'rgba(255,255,255,0.85)'),
        weight: 2,
        fillColor: done ?? (inSet ? MAP_COLORS.set : '#ffffff'),
        fillOpacity: done ? 0.8 : inSet ? 0.6 : 0.3,
        interactive: s.clickable === 'select' || s.clickable === 'answer',
        renderer: renderer.current ?? undefined,
      })
        .on('click', () => mapClickRef.current?.(iso))
        .addTo(group);
    }
    ring(s.focus, MAP_COLORS.focus);
    ring(s.wrong, MAP_COLORS.wrong);
    ring(s.correct, MAP_COLORS.correct);

    const capCountry = s.capital ? BY_ISO.get(s.correct || s.focus || '') : undefined;
    if (capCountry) {
      const lang = settingsRef.current.nameLang;
      const m = L.marker([capCountry.capital.lat, capCountry.capital.lng], { icon: pinIcon('capital'), keyboard: false, interactive: false, zIndexOffset: 1000 }).addTo(group);
      if (s.capitalLabel) m.bindTooltip(capCountry.capital[lang], { permanent: true, direction: 'top', offset: [0, -13], className: 'map-label' });
      for (const o of capCountry.otherCapitals) {
        const om = L.marker([o.lat, o.lng], { icon: pinIcon('other'), keyboard: false, interactive: false }).addTo(group);
        if (s.capitalLabel) om.bindTooltip(`${o[lang]} · ${o.role}`, { permanent: true, direction: 'bottom', offset: [0, 11], className: 'map-label map-label--small' });
      }
    }

    // "Wo liegt …?": the guess, the right place and a line between them.
    if (s.guess) L.marker(s.guess, { icon: pinIcon('guess'), keyboard: false, interactive: false, zIndexOffset: 900 }).addTo(group);
    if (s.truth) {
      const t = L.marker(s.truth, { icon: pinIcon('capital'), keyboard: false, interactive: false, zIndexOffset: 1000 }).addTo(group);
      if (s.truthLabel) t.bindTooltip(s.truthLabel, { permanent: true, direction: 'top', offset: [0, -13], className: 'map-label' });
      if (s.guess) L.polyline([s.guess, s.truth], { color: '#fff', weight: 2.5, dashArray: '6 6', interactive: false, renderer: renderer.current ?? undefined }).addTo(group);
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
    // Handy for checking outlines in the browser console during development.
    if (import.meta.env.DEV) (window as unknown as { __map?: L.Map }).__map = map;
    map.setView([22, 12], 2);
    map.attributionControl.setPrefix(false);
    L.control.zoom({ position: 'bottomright', zoomInTitle: 'Hineinzoomen', zoomOutTitle: 'Herauszoomen' }).addTo(map);
    L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 110 }).addTo(map);
    map.createPane('labels');
    const lp = map.getPane('labels')!;
    lp.style.zIndex = '450';
    lp.style.pointerEvents = 'none';
    labels.current = L.tileLayer(LABELS, { pane: 'labels', maxZoom: 18 });
    renderer.current = new ClipCanvas({ padding: 0.5, tolerance: 4 });
    detailGroup.current = L.layerGroup().addTo(map);
    markers.current = L.layerGroup().addTo(map);
    tip.current = L.tooltip({ direction: 'top', offset: [0, -10], className: 'map-label map-label--hover', opacity: 1 });
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (sceneRef.current.clickable === 'point') mapPointRef.current?.(e.latlng.lat, L.Util.wrapNum(e.latlng.lng, [-180, 180], true));
    });

    let cancelled = false;
    loadOverview().then((features) => {
      if (cancelled) return;
      // `renderer` is passed on to every polygon at runtime; the typings just don't list it.
      L.geoJSON({ type: 'FeatureCollection', features } as GeoJSON.FeatureCollection, {
        ...({ renderer: renderer.current } as L.GeoJSONOptions),
        style: (f) => styleFor(String((f as Geo).id)),
        onEachFeature: (f, lyr) => {
          const iso = String((f as Geo).id);
          geos.current.set(iso, f as Geo);
          overviewLayers.current.set(iso, lyr as L.Path);
          bindEvents(iso, lyr);
        },
      }).addTo(map);
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
    // The blank map follows light/dark mode.
    const mo = new MutationObserver(() => restyle());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      cancelled = true;
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      map.remove();
      mapRef.current = null;
      units.current.clear();
      stale.current = [];
      byIso.current.clear();
      detailLevel.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detailed outlines follow the camera.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const onMove = () => updateDetail();
    map.on('moveend zoomend resize', onMove);
    updateDetail();
    return () => {
      map.off('moveend zoomend resize', onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Basemap (satellite, relief, topographic map or none).
  const style = offline ? 'blank' : settings.mapStyle === 'streets' && scene.hideLabels ? 'terrain' : settings.mapStyle;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    baseTiles.current?.remove();
    baseTiles.current = null;
    if (style !== 'blank') {
      const b = BASEMAPS[style];
      baseTiles.current = L.tileLayer(b.url, { maxZoom: 18, maxNativeZoom: b.maxNativeZoom, attribution: `${b.attribution} · ${BORDERS_CREDIT}` }).addTo(map);
      baseTiles.current.bringToBack();
    } else {
      map.attributionControl.addAttribution(BORDERS_CREDIT);
    }
    return () => {
      map.attributionControl.removeAttribution(BORDERS_CREDIT);
    };
  }, [style]);

  // Scene changes: colours + markers.
  useEffect(() => {
    if (!ready) return;
    restyle();
    rebuildMarkers();
    tip.current?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, scene, settings.mapBorders, settings.nameLang, style]);

  // Camera moves only when a view asks for it (flyKey changes).
  useEffect(() => {
    if (ready) fly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, scene.flyKey]);

  // Place names overlay (never during quiz questions, it would give the answer away; the topographic map has its own).
  useEffect(() => {
    const map = mapRef.current;
    const lbl = labels.current;
    if (!map || !lbl) return;
    const show = settings.mapLabels && !scene.hideLabels && style !== 'streets';
    if (show && !map.hasLayer(lbl)) lbl.addTo(map);
    if (!show && map.hasLayer(lbl)) lbl.remove();
  }, [settings.mapLabels, scene.hideLabels, style]);

  return (
    // The style class sits on the wrapper: Leaflet adds its own classes to the map element, which React must not overwrite.
    <div className={`relative h-full w-full map-style-${style}`}>
      <div ref={container} className="world-map h-full w-full" role="application" aria-label="Interaktive Karte" />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="map-toast">Karte wird geladen …</span>
        </div>
      )}
      {ready && detailBusy && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-[500] -translate-x-1/2">
          <span className="map-toast map-toast--small">Genaue Grenzen werden geladen …</span>
        </div>
      )}
      {offline && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] text-center">
          <span className="map-toast map-toast--small">Offline – ohne Satellitenbild, die Umrisse funktionieren trotzdem.</span>
        </div>
      )}
    </div>
  );
}
