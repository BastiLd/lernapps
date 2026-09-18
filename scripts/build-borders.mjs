// Builds src/apps/laender/data/borders.json (TopoJSON, object "countries", id = ISO alpha-2)
// from Natural Earth (world-atlas, 1:10m), simplified so it stays small enough for the web.
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import mapshaper from 'mapshaper';

const require = createRequire(import.meta.url);
const worldCountries = require('world-countries');
const topo = JSON.parse(readFileSync('node_modules/world-atlas/countries-10m.json', 'utf8'));
const base = JSON.parse(readFileSync('data-src/base.json', 'utf8'));

const KEEP_PERCENT = process.argv[2] || '12%';
const inApp = new Set(base.map((c) => c.iso2));
const byNumeric = new Map(worldCountries.filter((c) => c.ccn3).map((c) => [c.ccn3, c.cca2]));

// Natural Earth units without an ISO numeric code.
const BY_NAME = { Kosovo: 'XK', 'N. Cyprus': 'CY', Somaliland: 'SO' };
const DROP = new Set(['Siachen Glacier', 'Indian Ocean Ter.', 'Cyprus U.N. Buffer Zone', 'Dhekelia', 'Akrotiri', 'Baikonur', 'Bajo Nuevo Bank', 'Serranilla Bank', 'Scarborough Reef', 'Spratly Is.', 'Clipperton I.', 'Coral Sea Is.', 'Ashmore and Cartier Is.', 'USNB Guantanamo Bay', 'Brazilian I.', 'Southern Patagonian Ice Field', 'Bir Tawil']);

const fc = feature(topo, topo.objects.countries);
const features = [];
const unmatched = [];
for (const f of fc.features) {
  const name = f.properties && f.properties.name;
  if (DROP.has(name)) continue;
  const iso2 = BY_NAME[name] || byNumeric.get(f.id);
  if (!iso2) {
    unmatched.push(`${name} (${f.id})`);
    continue;
  }
  features.push({ type: 'Feature', properties: { iso2 }, geometry: f.geometry });
}

// Parts of one country (e.g. Northern Cyprus + Cyprus) become one MultiPolygon. No geometric
// dissolve: that would join Fiji's islands across the date line into a ring around the world.
const grouped = new Map();
for (const f of features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  if (!grouped.has(f.properties.iso2)) grouped.set(f.properties.iso2, []);
  grouped.get(f.properties.iso2).push(...polys);
}
features.length = 0;
// Rings that touch both -180° and +180° (Russia's Chukotka, Fiji) would be drawn as a line around
// the whole globe. Shifting their western points by +360° keeps every ring continuous.
const unwrap = (ring) => {
  const lngs = ring.map((p) => p[0]);
  if (Math.max(...lngs) - Math.min(...lngs) <= 180) return ring;
  return ring.map(([x, y]) => [x < 0 ? x + 360 : x, y]);
};
for (const [iso2, polys] of grouped) {
  features.push({ type: 'Feature', properties: { iso2 }, geometry: { type: 'MultiPolygon', coordinates: iso2 === 'AQ' ? polys : polys.map((poly) => poly.map(unwrap)) } });
}

const missing = [...inApp].filter((iso) => !features.some((f) => f.properties.iso2 === iso));
if (missing.length) throw new Error(`Keine Grenzen für: ${missing.join(', ')}`);

mkdirSync('data-src/tmp', { recursive: true });
writeFileSync('data-src/tmp/countries.geojson', JSON.stringify({ type: 'FeatureCollection', features }));
mkdirSync('src/apps/laender/data', { recursive: true });

await mapshaper.runCommands(
  [
    '-i data-src/tmp/countries.geojson',
    `-simplify ${KEEP_PERCENT} weighted keep-shapes`,
    '-rename-layers countries',
    '-o src/apps/laender/data/borders.json format=topojson id-field=iso2 quantization=100000 force',
  ].join(' '),
);

const out = JSON.parse(readFileSync('src/apps/laender/data/borders.json', 'utf8'));
const ids = out.objects.countries.geometries.map((g) => g.id);
const stillMissing = [...inApp].filter((iso) => !ids.includes(iso));
console.log(`borders.json: ${ids.length} Gebiete, ${Math.round(statSync('src/apps/laender/data/borders.json').size / 1024)} KB (keep ${KEEP_PERCENT})`);
if (unmatched.length) console.log(`Ohne Zuordnung (weggelassen): ${unmatched.join(', ')}`);
if (stillMissing.length) throw new Error(`Nach dem Vereinfachen fehlen: ${stillMissing.join(', ')}`);
