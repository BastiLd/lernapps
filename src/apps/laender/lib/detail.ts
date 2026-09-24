import type { Topology } from 'topojson-specification';
import index from '../data/detail-index.json';
import { toFeatures, type Geo } from './geo';

/**
 * Detailed country outlines, loaded while zoomed in (see scripts/build-borders.mjs):
 * "mid" (~250 m, one file per country region) from zoom 5, "fine" (~50 m, 2° × 2° tiles) from zoom 9.
 */
export type DetailLevel = 'mid' | 'fine';

export function detailLevelFor(zoom: number): DetailLevel | null {
  if (zoom >= 9) return 'fine';
  if (zoom >= 5) return 'mid';
  return null;
}

/** [west, south, east, north] */
export type Box = [number, number, number, number];

export interface DetailUnit {
  key: string;
  isos: string[];
  box: Box;
  /** Tile completely inside one country – drawn as a square, nothing to download. */
  solid?: boolean;
}

interface Index {
  mid: Record<string, Box[]>;
  fine: { size: number; tiles: Record<string, string[]>; solid: Record<string, string> };
}

const IDX = index as unknown as Index;
const TILE = IDX.fine.size;
/** How far the tile files reach beyond their square (must match TILE_MARGIN in the build script). */
const MARGIN = 0.02;
const Q = 1e4;

function tileBox(key: string): Box {
  const [x, y] = key.split('_').map(Number);
  return [x * TILE, y * TILE, (x + 1) * TILE, (y + 1) * TILE];
}

export const UNITS: Record<DetailLevel, DetailUnit[]> = {
  mid: Object.entries(IDX.mid).flatMap(([id, boxes]) => boxes.map((box, k) => ({ key: `${id}.${k}`, isos: [id], box }))),
  fine: [
    ...Object.entries(IDX.fine.tiles).map(([key, isos]) => ({ key, isos, box: tileBox(key) })),
    ...Object.entries(IDX.fine.solid).map(([key, iso]) => ({ key, isos: [iso], box: tileBox(key), solid: true })),
  ],
};

/** A piece of a country: a GeoJSON feature (mid) or rings of [lat, lng] that are only drawn inside `clip` (fine). */
export type Piece = { iso: string; geo: Geo } | { iso: string; rings: [number, number][][]; clip: Box };

function decodeRing(a: number[]): [number, number][] {
  const out: [number, number][] = [];
  let x = 0;
  let y = 0;
  for (let k = 0; k < a.length; k += 2) {
    x += a[k];
    y += a[k + 1];
    out.push([y / Q, x / Q]);
  }
  return out;
}

const cache = new Map<string, Promise<Piece[] | null>>();
const MAX_CACHED = 500;

function fetchUnit(level: DetailLevel, unit: DetailUnit): Promise<Piece[] | null> {
  const [w, s, e, n] = unit.box;
  if (unit.solid) {
    const ring: [number, number][] = [
      [s - MARGIN, w - MARGIN],
      [s - MARGIN, e + MARGIN],
      [n + MARGIN, e + MARGIN],
      [n + MARGIN, w - MARGIN],
    ];
    return Promise.resolve([{ iso: unit.isos[0], rings: [ring], clip: unit.box }]);
  }
  const url = `${import.meta.env.BASE_URL}geo/${level}/${unit.key}.json`;
  return fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((data): Piece[] | null => {
      if (!data) return null;
      if (level === 'mid') {
        const geo = toFeatures(data as Topology)[0];
        return geo ? [{ iso: unit.isos[0], geo }] : null;
      }
      return (data as { f: { i: string; r: number[][] }[] }).f.map((f) => ({ iso: f.i, rings: f.r.map(decodeRing), clip: unit.box }));
    })
    .catch(() => null);
}

export function loadUnit(level: DetailLevel, unit: DetailUnit): Promise<Piece[] | null> {
  const key = `${level}/${unit.key}`;
  let p = cache.get(key);
  if (!p) {
    p = fetchUnit(level, unit).then((pieces) => {
      // Offline or failed: forget it, so the next attempt tries again (the coarser outline is shown meanwhile).
      if (!pieces) cache.delete(key);
      return pieces;
    });
    cache.set(key, p);
    // Keep memory in check when roaming around the world at high zoom.
    while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  }
  return p;
}
