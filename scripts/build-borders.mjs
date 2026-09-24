// Builds the country outlines for the map from geoBoundaries CGAZ ADM0 (CC BY 4.0). Coasts and river
// borders match the satellite images far better than Natural Earth (which was off by up to 1–2 km).
//
//   src/apps/laender/data/borders.json   whole world, ~3 km detail – bundled with the app (world view)
//   public/geo/mid/<id>.<n>.json          ~400 m detail – loaded when zoomed in (z ≥ 5)
//   public/geo/hi/<id>.<n>.json           ~100 m detail – loaded when zoomed in further (z ≥ 8)
//   src/apps/laender/data/detail-index.json   which detail file covers which area (bounding boxes)
//
// Detail files are split by region (<n>): Spain's mainland and the Canary Islands, or the US mainland,
// Alaska and Hawaii are separate files, so zooming into one region never downloads the others.
//   src/apps/laender/data/shapes.json     country silhouettes as SVG paths (detail page, "Umriss" questions)
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
  hi: { interval: 100, precision: 0.0001 },
  mid: { interval: 400, precision: 0.0005 },
  overview: { interval: 3000, precision: 0.001 },
};
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

// ---------------------------------------------------------------- 3. detail files per region
const midFixed = fixUp(JSON.parse(simplified['mid.json']));
const regions = new Map(midFixed.features.map((f) => [f.properties.id, regionsOf(polysOf(f.geometry))]));
const index = {};
for (const name of ['hi', 'mid']) {
  log(`Detailstufe ${name} …`);
  const fc = splitRegions(name === 'mid' ? midFixed : fixUp(JSON.parse(simplified[`${name}.json`])), regions);
  if (name === 'hi') {
    // Bounding box of every region, from the most detailed outlines (rounded outwards).
    for (const f of fc.features) {
      const [id, k] = f.properties.key.split('.');
      const b = bboxOf(polysOf(f.geometry).map((p) => p[0]));
      (index[id] ??= [])[Number(k)] = [Math.floor(b[0] * 100) / 100, Math.floor(b[1] * 100) / 100, Math.ceil(b[2] * 100) / 100, Math.ceil(b[3] * 100) / 100];
    }
  }
  const files = await dissolve(fc, `-split key -o format=topojson singles precision=${LEVELS[name].precision}`, 'key');
  log(`public/geo/${name}: ${writeDir(`public/geo/${name}`, files)}`);
}
writeFileSync('src/apps/laender/data/detail-index.json', JSON.stringify(index));
const multi = Object.entries(index).filter(([, r]) => r.length > 1);
log(`detail-index.json: ${Object.keys(index).length} Gebiete, ${multi.length} davon in mehreren Regionen (z. B. ${multi.slice(0, 6).map(([id, r]) => `${id}: ${r.length}`).join(', ')})`);

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

function silhouette(id, geometry) {
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

  const rings = chosen.flatMap((x) => x.p.map((ring) => ring.map(([lng, lat]) => [lng, -mercY(lat)])));
  const [minX, minY, maxX, maxY] = bboxOf(rings);
  const scale = 100 / Math.max(maxX - minX, maxY - minY);
  const r1 = (v) => Math.round(v * 10) / 10;
  const projected = rings.map((ring) => simplifyDP(ring.map(([x, y]) => [(x - minX) * scale, (y - minY) * scale]), 0.28)).filter((ring) => ring.length >= 4);
  // Specks below ~1 unit² (of 100 × 100) are invisible; island states keep their biggest islands anyway.
  let visible = projected.filter((ring) => planarArea(ring) > 0.8);
  if (!visible.length) visible = projected.sort((a, b) => planarArea(b) - planarArea(a)).slice(0, 12);
  const d = visible.map((ring) => `M${ring.slice(0, -1).map(([x, y]) => `${r1(x)} ${r1(y)}`).join(' ')}Z`).join('');
  return { w: r1((maxX - minX) * scale), h: r1((maxY - minY) * scale), d };
}

const mid = JSON.parse((await dissolve(midFixed, `-o m.json format=geojson precision=${LEVELS.mid.precision}`))['m.json']);
const shapes = {};
for (const f of mid.features) {
  const id = f.properties.id;
  if (!inApp.has(id)) continue;
  const s = silhouette(id, f.geometry);
  if (s?.d) shapes[id] = s;
}
const noShape = [...inApp].filter((iso) => !shapes[iso]);
const shapesJson = JSON.stringify(shapes);
writeFileSync('src/apps/laender/data/shapes.json', shapesJson);
log(`shapes.json: ${Object.keys(shapes).length} Umrisse, ${Math.round(shapesJson.length / 1024)} KB${noShape.length ? ` – ohne: ${noShape.join(' ')}` : ''}`);
