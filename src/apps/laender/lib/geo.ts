import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import detailIndex from '../data/detail-index.json';

export type Geo = Feature<Polygon | MultiPolygon, { id?: string }>;

/**
 * Detail levels of the country outlines (see scripts/build-borders.mjs):
 * the bundled overview (~3 km) for the world view, ~400 m from zoom 5 and ~100 m from zoom 8.
 */
export type DetailLevel = 'mid' | 'hi';

export function detailLevelFor(zoom: number): DetailLevel | null {
  if (zoom >= 8) return 'hi';
  if (zoom >= 5) return 'mid';
  return null;
}

function toFeatures(topo: Topology): Geo[] {
  const object = Object.values(topo.objects)[0];
  const fc = feature(topo, object) as unknown as FeatureCollection<Polygon | MultiPolygon, { id?: string }>;
  return fc.features.map((f) => ({ ...f, id: String(f.id ?? f.properties?.id ?? '') }));
}

let overview: Promise<Geo[]> | null = null;
export function loadOverview(): Promise<Geo[]> {
  overview ??= import('../data/borders.json').then((m) => toFeatures(m.default as unknown as Topology));
  return overview;
}

/** A detail region: "ES.0" (Spanish mainland + Balearic Islands), "ES.1" (Canary Islands) … */
export interface Region {
  key: string;
  id: string;
  /** [west, south, east, north] */
  box: [number, number, number, number];
}

export const REGIONS: Region[] = Object.entries(detailIndex as unknown as Record<string, [number, number, number, number][]>).flatMap(([id, boxes]) =>
  boxes.map((box, k) => ({ key: `${id}.${k}`, id, box })),
);

const details = new Map<string, Promise<Geo | null>>();
export function loadDetail(level: DetailLevel, region: string): Promise<Geo | null> {
  const key = `${level}/${region}`;
  let p = details.get(key);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}geo/${key}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Topology>) : null))
      .then((topo) => (topo ? (toFeatures(topo)[0] ?? null) : null))
      .catch(() => null)
      .then((geo) => {
        // Offline or failed: forget it, so the next attempt tries again (the overview is shown meanwhile).
        if (!geo) details.delete(key);
        return geo;
      });
    details.set(key, p);
  }
  return p;
}

export interface Shape {
  w: number;
  h: number;
  d: string;
}

let shapes: Promise<Record<string, Shape>> | null = null;
export function loadShapes(): Promise<Record<string, Shape>> {
  shapes ??= import('../data/shapes.json').then((m) => m.default as unknown as Record<string, Shape>);
  return shapes;
}
