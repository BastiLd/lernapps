import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';

export type Geo = Feature<Polygon | MultiPolygon, { id?: string }>;

export function toFeatures(topo: Topology): Geo[] {
  const object = Object.values(topo.objects)[0];
  const fc = feature(topo, object) as unknown as FeatureCollection<Polygon | MultiPolygon, { id?: string }>;
  return fc.features.map((f) => ({ ...f, id: String(f.id ?? f.properties?.id ?? '') }));
}

let overview: Promise<Geo[]> | null = null;
/** Outlines of the whole world (~3 km detail), bundled with the app. */
export function loadOverview(): Promise<Geo[]> {
  overview ??= import('../data/borders.json').then((m) => toFeatures(m.default as unknown as Topology));
  return overview;
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
