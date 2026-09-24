// Builds the country outlines for the map from geoBoundaries CGAZ ADM0 (CC BY 4.0). Coasts and river
// borders match the satellite images far better than Natural Earth (which was off by up to 1–2 km).
//
//   src/apps/laender/data/borders.json   whole world, ~3 km detail – bundled with the app (world view, zoom < 5)
//   public/geo/mid/<id>.<n>.json          ~250 m detail per country region – loaded when zoomed in (zoom 5–9)
//   public/geo/fine/<x>_<y>.json          ~50 m detail in 2° × 2° tiles – loaded when zoomed in further (zoom ≥ 9)
//   src/apps/laender/data/detail-index.json   which file covers which area
//   src/apps/laender/data/shapes.json     country silhouettes as SVG paths (detail page, "Umriss" questions)
//   src/apps/laender/data/shapes-true.json   the same in an equal-area projection with a km scale (size comparison)
//
// Mid files are split by region (<n>): Spain's mainland and the Canary Islands are separate files. The 50 m
// level is cut into tiles, so zooming into Canada never downloads all of Canada: each tile holds the parts of
// all countries inside it, cut a little beyond the tile edge – the app draws each tile only inside its exact
// square, so the cut lines are never visible.
//
// The download (~100 MB) is cached outside the project (OS temp folder), so OneDrive and Git never see it.
// Usage: npm run data:borders
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mapshaper from 'mapshaper';

const require = createRequire(import.meta.url);
const worldCountries = require('world-countries');

const CACHE = process.env.GEO_CACHE || join(tmpdir(), 'lernapps-geo');
const SHP = join(CACHE, 'geoBoundariesCGAZ_ADM0.shp');
const ZIP_URL = 'https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/CGAZ/geoBoundariesCGAZ_ADM0.zip';

const LEVELS = {
  fine: { interval: 50, precision: 0.0001 },
  mid: { interval: 250, precision: 0.0003 },
  overview: { interval: 3000, precision: 0.001 },
};
/** Tile size (degrees) and how far beyond its edge each tile's outlines reach (degrees). */
const TILE = 2;
const TILE_MARGIN = 0.02;
/** Coordinates in the tile files are integers in 1/10 000° (≈ 11 m). */
const Q = 1e4;
const OVERVIEW_MIN_ISLAND_KM2 = 40;
/** Parts of a country further apart than this (degrees) go into separate detail files. */
const REGION_GAP = 3;

// Countries on both sides of the 180° meridian. +1: move the western parts by +360° (they belong next to
// a capital in the east), -1: move the eastern parts by -360° (US: the Aleutian tip beyond 180°).
const DATELINE = { RU: 1, FJ: 1, KI: 1, NZ: 1, US: -1 };

const base = JSON.parse(readFileSync('data-src/base.json', 'utf8'));
const inApp = new Set(base.map((c) => c.iso2));

const t0 = Date.now();
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(3)} s] ${msg}`);

async function ensureSource() {
  if (existsSync(SHP)) return;
  mkdirSync(CACHE, { recursive: true });
  const zip = join(CACHE, 'geoBoundariesCGAZ_ADM0.zip');
  if (!existsSync(zip)) {
    log(`Lade ${ZIP_URL} (~100 MB) …`);
    const res = await fetch(ZIP_URL);
    if (!res.ok) throw new Error(`Download fehlgeschlagen: HTTP ${res.status}`);
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  }
  execFileSync('tar', ['-xf', zip, '-C', CACHE]);
}

const polysOf = (g) => (!g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.coordinates);

function bboxOf(rings) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of rings)
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  return [minX, minY, maxX, maxY];
}

function planarArea(ring) {
  let a = 0;
  for (let k = 0, j = ring.length - 1; k < ring.length; j = k++) a += (ring[j][0] + ring[k][0]) * (ring[j][1] - ring[k][1]);
  return Math.abs(a / 2);
}

/** Approximate area in km² (equirectangular – good enough to rank polygons). */
function areaKm2(poly) {
  const k = 111.32 * 111.32 * Math.cos((poly[0][0][1] * Math.PI) / 180);
  return Math.max(0, poly.reduce((sum, ring, i) => sum + (i ? -1 : 1) * planarArea(ring) * k, 0));
}

// ---------------------------------------------------------------- 1. read + simplify (all levels in one pass)
await ensureSource();
const ISO2 = Object.fromEntries(worldCountries.map((c) => [c.cca3, c.cca2]));
// CGAZ codes that differ: Kosovo, and Palestine is split into West Bank (129) and Gaza Strip (118).
Object.assign(ISO2, { XKX: 'XK', 129: 'PS', 118: 'PS' });

log('Lese CGAZ und vereinfache …');
const simplified = await mapshaper.applyCommands(
  [
    `-i "${SHP}" snap`,
    // Disputed areas without a country in the app (Aksai Chin, Falklands …) keep a neutral id "x<code>".
    `-each 'id = (${JSON.stringify(ISO2)})[shapeGroup] || ("x" + shapeGroup)'`,
    '-filter-fields id',
    ...Object.entries(LEVELS).map(([name, l]) => `-simplify interval=${l.interval} keep-shapes -o ${name}.json format=geojson precision=${l.precision / 10}`),
  ].join(' '),
);

// ---------------------------------------------------------------- 2. fix-ups (per level)
function fixUp(fc) {
  const parts = new Map(); // id -> polygons
  for (const f of fc.features) {
    for (const poly of polysOf(f.geometry)) {
      const [minX, minY, maxX, maxY] = bboxOf([poly[0]]);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      // CGAZ counts Puerto Rico (incl. Vieques, Culebra, Mona) as part of the USA; the app lists it separately.
      const id = f.properties.id === 'US' && cx > -68.1 && cx < -65.2 && cy > 17.6 && cy < 18.7 ? 'PR' : f.properties.id;
      const dir = DATELINE[id];
      if ((dir === 1 && cx < -140) || (dir === -1 && cx > 170)) for (const ring of poly) for (const p of ring) p[0] += 360 * dir;
      if (!parts.has(id)) parts.set(id, []);
      parts.get(id).push(poly);
    }
  }
  const missing = [...inApp].filter((iso) => !parts.has(iso));
  if (missing.length) throw new Error(`Keine Grenzen für: ${missing.join(', ')}`);
  return {
    type: 'FeatureCollection',
    features: [...parts].map(([id, polys]) => ({ type: 'Feature', properties: { id }, geometry: { type: 'MultiPolygon', coordinates: polys } })),
  };
}

// Merges the parts of each id (West Bank + Gaza, both halves of islands cut at 180° …) into one feature.
const dissolve = (fc, commands, field = 'id') => mapshaper.applyCommands(`-i in.json snap -dissolve ${field} ${commands}`, { 'in.json': JSON.stringify(fc) });

// ---------------------------------------------------------------- regions (for splitting the detail files)
const gap = (a, b) => Math.max(0, a[0] - b[2], b[0] - a[2], a[1] - b[3], b[1] - a[3]);
const union = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];

/** Groups the polygons of one country into regions: everything closer than REGION_GAP stays together. */
function regionsOf(polys) {
  const items = polys.map((p) => ({ box: bboxOf([p[0]]), area: areaKm2(p) }));
  const groups = items.map((x) => ({ box: x.box, area: x.area }));
  for (let merged = true; merged; ) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++)
        if (gap(groups[i].box, groups[j].box) <= REGION_GAP) {
          groups[i] = { box: union(groups[i].box, groups[j].box), area: groups[i].area + groups[j].area };
          groups.splice(j, 1);
          merged = true;
          break outer;
        }
  }
  // Region 0 is the main one (largest land area).
  return groups.sort((a, b) => b.area - a.area).map((g) => g.box);
}

const regionOf = (boxes, poly) => {
  const b = bboxOf([poly[0]]);
  let best = 0;
  boxes.forEach((r, i) => {
    if (gap(r, b) < gap(boxes[best], b)) best = i;
  });
  return best;
};

/** One feature per country region, with "key" = "<id>.<region>". */
function splitRegions(fc, regions) {
  const features = [];
  for (const f of fc.features) {
    const id = f.properties.id;
    const byRegion = new Map();
    for (const poly of polysOf(f.geometry)) {
      const k = regionOf(regions.get(id), poly);
      if (!byRegion.has(k)) byRegion.set(k, []);
      byRegion.get(k).push(poly);
    }
    for (const [k, polys] of byRegion) features.push({ type: 'Feature', properties: { key: `${id}.${k}` }, geometry: { type: 'MultiPolygon', coordinates: polys } });
  }
  return { type: 'FeatureCollection', features };
}

function writeDir(dir, files) {
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  let bytes = 0;
  let biggest = ['', 0];
  let n = 0;
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
    bytes += content.length;
    n++;
    if (content.length > biggest[1]) biggest = [name, content.length];
  }
  return `${n} Dateien, ${(bytes / 1e6).toFixed(1)} MB (größte: ${biggest[0]} ${Math.round(biggest[1] / 1024)} KB)`;
}

// ---------------------------------------------------------------- 3a. mid detail per region
const midFixed = fixUp(JSON.parse(simplified['mid.json']));
const regions = new Map(midFixed.features.map((f) => [f.properties.id, regionsOf(polysOf(f.geometry))]));
// fine.tiles: tile -> countries in its file; fine.solid: tiles completely inside one country (no file needed).
const index = { mid: {}, fine: { size: TILE, tiles: {}, solid: {} } };
{
  log('Detailstufe mittel (~250 m) …');
  const fc = splitRegions(midFixed, regions);
  for (const f of fc.features) {
    const [id, k] = f.properties.key.split('.');
    const b = bboxOf(polysOf(f.geometry).map((p) => p[0]));
    (index.mid[id] ??= [])[Number(k)] = [Math.floor(b[0] * 100) / 100, Math.floor(b[1] * 100) / 100, Math.ceil(b[2] * 100) / 100, Math.ceil(b[3] * 100) / 100];
  }
  const files = await dissolve(fc, `-split key -o format=topojson singles precision=${LEVELS.mid.precision}`, 'key');
  log(`public/geo/mid: ${writeDir('public/geo/mid', files)}`);
}

// ---------------------------------------------------------------- 3b. fine detail in tiles
/** Sutherland–Hodgman against one axis-parallel line; keeps the side where coord >= v (keepAbove) or <= v. */
function clipHalf(pts, axis, v, keepAbove) {
  const out = [];
  if (!pts.length) return out;
  const inside = (p) => (keepAbove ? p[axis] >= v : p[axis] <= v);
  let prev = pts[pts.length - 1];
  let prevIn = inside(prev);
  for (const cur of pts) {
    const curIn = inside(cur);
    if (curIn !== prevIn) {
      const t = (v - prev[axis]) / (cur[axis] - prev[axis]);
      out.push(axis === 0 ? [v, prev[1] + t * (cur[1] - prev[1])] : [prev[0] + t * (cur[0] - prev[0]), v]);
    }
    if (curIn) out.push(cur);
    prev = cur;
    prevIn = curIn;
  }
  return out;
}
const clipBand = (pts, axis, min, max) => clipHalf(clipHalf(pts, axis, min, true), axis, max, false);

/** Quantized, delta-encoded ring: [x0, y0, dx1, dy1, …] in 1/Q degrees; null if it collapses. */
function encodeRing(pts) {
  const out = [];
  let px = null;
  let py = null;
  for (const [x, y] of pts) {
    const qx = Math.round(x * Q);
    const qy = Math.round(y * Q);
    if (qx === px && qy === py) continue;
    if (px === null) out.push(qx, qy);
    else out.push(qx - px, qy - py);
    px = qx;
    py = qy;
  }
  return out.length >= 6 ? out : null;
}

log('Detailstufe fein (~50 m) …');
const fineFixed = JSON.parse((await dissolve(fixUp(JSON.parse(simplified['fine.json'])), `-o f.json format=geojson precision=${LEVELS.fine.precision / 10}`))['f.json']);
delete simplified['fine.json'];
const tiles = new Map(); // "x_y" -> Map(id -> rings)
const addToTile = (key, id, ring) => {
  if (!tiles.has(key)) tiles.set(key, new Map());
  const t = tiles.get(key);
  if (!t.has(id)) t.set(id, []);
  t.get(id).push(ring);
};
for (const f of fineFixed.features) {
  const id = f.properties.id;
  if (id === 'AQ') continue; // Antarctica: the ~250 m level is plenty
  for (const poly of polysOf(f.geometry)) {
    for (const closed of poly) {
      const ring = closed.slice(0, -1);
      const [minX, minY, maxX, maxY] = bboxOf([ring]);
      for (let ty = Math.floor((minY - TILE_MARGIN) / TILE); ty <= Math.floor((maxY + TILE_MARGIN) / TILE); ty++) {
        const y0 = ty * TILE - TILE_MARGIN;
        const y1 = (ty + 1) * TILE + TILE_MARGIN;
        const band = minY >= y0 && maxY <= y1 ? ring : clipBand(ring, 1, y0, y1);
        if (band.length < 3) continue;
        const [bx0, , bx1] = bboxOf([band]);
        for (let tx = Math.floor((bx0 - TILE_MARGIN) / TILE); tx <= Math.floor((bx1 + TILE_MARGIN) / TILE); tx++) {
          const x0 = tx * TILE - TILE_MARGIN;
          const x1 = (tx + 1) * TILE + TILE_MARGIN;
          const cell = bx0 >= x0 && bx1 <= x1 ? band : clipBand(band, 0, x0, x1);
          if (cell.length < 3 || planarArea(cell) < 1e-10) continue;
          const enc = encodeRing(cell);
          if (enc) addToTile(`${tx}_${ty}`, id, enc);
        }
      }
    }
  }
}
{
  const files = {};
  const full = (TILE + 2 * TILE_MARGIN) ** 2 * Q * Q;
  for (const [key, byId] of tiles) {
    const [only] = byId.values();
    const ring = only[0];
    if (byId.size === 1 && only.length === 1 && ring.length <= 12) {
      // Decode the few points and check whether the ring is the whole (extended) tile square.
      const pts = [];
      for (let k = 0, x = 0, y = 0; k < ring.length; k += 2) pts.push([(x += ring[k]), (y += ring[k + 1])]);
      if (planarArea(pts) >= full * 0.999) {
        index.fine.solid[key] = [...byId.keys()][0];
        continue;
      }
    }
    files[`${key}.json`] = JSON.stringify({ f: [...byId].map(([i, r]) => ({ i, r })) });
    index.fine.tiles[key] = [...byId.keys()];
  }
  log(`public/geo/fine: ${writeDir('public/geo/fine', files)}`);
}
if (existsSync('public/geo/hi')) rmSync('public/geo/hi', { recursive: true });
writeFileSync('src/apps/laender/data/detail-index.json', JSON.stringify(index));
log(`detail-index.json: ${Object.keys(index.mid).length} Gebiete (mittel), ${Object.keys(index.fine.tiles).length} Kacheln als Datei + ${Object.keys(index.fine.solid).length} ganz ausgefüllte (fein)`);

// ---------------------------------------------------------------- 4. overview (bundled)
log('Übersicht …');
const ovOut = await dissolve(fixUp(JSON.parse(simplified['overview.json'])), `-o ov.json format=geojson precision=${LEVELS.overview.precision}`);
const ov = JSON.parse(ovOut['ov.json']);
// Tiny islands only cost bytes at world scale – except for small countries, which may consist of nothing else.
for (const f of ov.features) {
  const polys = polysOf(f.geometry);
  const areas = polys.map(areaKm2);
  const total = areas.reduce((a, b) => a + b, 0);
  const largest = Math.max(...areas);
  if (total < 30000) continue;
  f.geometry = { type: 'MultiPolygon', coordinates: polys.filter((_, i) => areas[i] >= OVERVIEW_MIN_ISLAND_KM2 || areas[i] === largest) };
}
const topo = (await mapshaper.applyCommands('-i ov.json -rename-layers countries -o borders.json format=topojson id-field=id quantization=1e5', { 'ov.json': JSON.stringify(ov) }))['borders.json'];
writeFileSync('src/apps/laender/data/borders.json', topo);
log(`borders.json: ${ov.features.length} Gebiete, ${Math.round(topo.length / 1024)} KB`);

// ---------------------------------------------------------------- 5. silhouettes
const RAD = Math.PI / 180;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * RAD) / 2)) / RAD;

function bboxDistKm(a, b) {
  const lat = ((a[1] + a[3] + b[1] + b[3]) / 4) * RAD;
  const dx = Math.max(0, a[0] - b[2], b[0] - a[2]) * 111.32 * Math.cos(lat);
  const dy = Math.max(0, a[1] - b[3], b[1] - a[3]) * 111.32;
  return Math.hypot(dx, dy);
}

function simplifyDP(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  // Rings are closed (first = last point), so split them at the point farthest from the start.
  let far = 1;
  for (let i = 1; i < pts.length - 1; i++) if (Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]) > Math.hypot(pts[far][0] - pts[0][0], pts[far][1] - pts[0][1])) far = i;
  keep[0] = keep[far] = keep[pts.length - 1] = 1;
  const stack = [
    [0, far],
    [far, pts.length - 1],
  ];
  while (stack.length) {
    const [s, e] = stack.pop();
    const [x1, y1] = pts[s];
    const [x2, y2] = pts[e];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1e-9;
    let best = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / len;
      if (d > best) {
        best = d;
        idx = i;
      }
    }
    if (best > tol) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Lambert azimuthal equal-area projection around (lng0, lat0), in km – areas keep their true size. */
function equalArea(lng0, lat0) {
  const R = 6371;
  const l0 = lng0 * RAD;
  const p0 = lat0 * RAD;
  return ([lng, lat]) => {
    const l = lng * RAD - l0;
    const p = lat * RAD;
    const k = Math.sqrt(2 / (1 + Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l)));
    return [R * k * Math.cos(p) * Math.sin(l), -R * k * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l))];
  };
}

/**
 * Silhouette of a country as an SVG path in a 100-unit box. Mercator (as on the map) for recognising the
 * shape, or equal-area with "km" = kilometres per unit for comparing true sizes.
 */
function silhouette(id, geometry, trueSize = false) {
  let polys = polysOf(geometry).map((p) => ({ p, area: areaKm2(p), box: bboxOf([p[0]]) }));
  if (id === 'US') polys = polys.filter((x) => x.box[1] < 50 && x.box[0] > -130); // lower 48 states – as on most maps
  polys.sort((a, b) => b.area - a.area);
  if (!polys.length) return null;
  // Main landmass plus everything nearby (Balearic Islands yes, Canary Islands no).
  const main = polys[0];
  let box = main.box.slice();
  const diag = bboxDistKm([box[0], box[1], box[0], box[1]], [box[2], box[3], box[2], box[3]]);
  const reach = Math.max(0.15 * diag, 150);
  const used = new Set([main]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const x of polys) {
      if (used.has(x) || bboxDistKm(x.box, box) > reach) continue;
      used.add(x);
      box = [Math.min(box[0], x.box[0]), Math.min(box[1], x.box[1]), Math.max(box[2], x.box[2]), Math.max(box[3], x.box[3])];
      changed = true;
    }
  }
  const total = [...used].reduce((a, x) => a + x.area, 0);
  const chosen = [...used].filter((x) => x.area >= total * 0.0008 || total < 2000);

  const project = trueSize ? equalArea((box[0] + box[2]) / 2, (box[1] + box[3]) / 2) : ([lng, lat]) => [lng, -mercY(lat)];
  const rings = chosen.flatMap((x) => x.p.map((ring) => ring.map(project)));
  const [minX, minY, maxX, maxY] = bboxOf(rings);
  const scale = 100 / Math.max(maxX - minX, maxY - minY);
  const r1 = (v) => Math.round(v * 10) / 10;
  const projected = rings.map((ring) => simplifyDP(ring.map(([x, y]) => [(x - minX) * scale, (y - minY) * scale]), trueSize ? 0.45 : 0.28)).filter((ring) => ring.length >= 4);
  // Specks below ~1 unit² (of 100 × 100) are invisible; island states keep their biggest islands anyway.
  let visible = projected.filter((ring) => planarArea(ring) > 0.8);
  if (!visible.length) visible = projected.sort((a, b) => planarArea(b) - planarArea(a)).slice(0, 12);
  if (!visible.length) visible = rings.map((ring) => ring.map(([x, y]) => [(x - minX) * scale, (y - minY) * scale])).filter((ring) => ring.length >= 4);
  const d = visible.map((ring) => `M${ring.slice(0, -1).map(([x, y]) => `${r1(x)} ${r1(y)}`).join(' ')}Z`).join('');
  const shape = { w: r1((maxX - minX) * scale), h: r1((maxY - minY) * scale), d };
  return trueSize ? { ...shape, km: Math.round((1 / scale) * 1000) / 1000 } : shape;
}

const mid = JSON.parse((await dissolve(midFixed, `-o m.json format=geojson precision=${LEVELS.mid.precision}`))['m.json']);
const shapes = {};
const trueShapes = {};
for (const f of mid.features) {
  const id = f.properties.id;
  if (!inApp.has(id)) continue;
  const s = silhouette(id, f.geometry);
  if (s?.d) shapes[id] = s;
  const t = silhouette(id, f.geometry, true);
  if (t?.d) trueShapes[id] = t;
}
const trueJson = JSON.stringify(trueShapes);
writeFileSync('src/apps/laender/data/shapes-true.json', trueJson);
log(`shapes-true.json: ${Object.keys(trueShapes).length} flächentreue Umrisse, ${Math.round(trueJson.length / 1024)} KB`);
const noShape = [...inApp].filter((iso) => !shapes[iso]);
const shapesJson = JSON.stringify(shapes);
writeFileSync('src/apps/laender/data/shapes.json', shapesJson);
log(`shapes.json: ${Object.keys(shapes).length} Umrisse, ${Math.round(shapesJson.length / 1024)} KB${noShape.length ? ` – ohne: ${noShape.join(' ')}` : ''}`);
