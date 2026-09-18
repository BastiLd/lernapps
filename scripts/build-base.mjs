// Builds data-src/base.json: the list of countries in the app plus facts that come
// from open datasets (names, region, area, borders, capital coordinates, population).
// Run once; the hand-/AI-written content lives in data-src/content/*.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const worldCountries = require('world-countries');

const EXTRA = { VA: 'observer', PS: 'observer', XK: 'partial', TW: 'partial', PR: 'territory' };

const SUBREGION_DE = {
  'North America': 'Nordamerika',
  'Central America': 'Mittelamerika',
  Caribbean: 'Karibik',
  'South America': 'Südamerika',
  'Northern Europe': 'Nordeuropa',
  'Western Europe': 'Westeuropa',
  'Southern Europe': 'Südeuropa',
  'Southeast Europe': 'Südosteuropa',
  'Eastern Europe': 'Osteuropa',
  'Central Europe': 'Mitteleuropa',
  'Western Asia': 'Westasien',
  'Central Asia': 'Zentralasien',
  'Southern Asia': 'Südasien',
  'Eastern Asia': 'Ostasien',
  'South-Eastern Asia': 'Südostasien',
  'Northern Africa': 'Nordafrika',
  'Western Africa': 'Westafrika',
  'Middle Africa': 'Zentralafrika',
  'Eastern Africa': 'Ostafrika',
  'Southern Africa': 'Südliches Afrika',
  'Australia and New Zealand': 'Australien & Neuseeland',
  Melanesia: 'Melanesien',
  Micronesia: 'Mikronesien',
  Polynesia: 'Polynesien',
};

function continentsOf(c) {
  if (c.cca2 === 'RU') return ['europe', 'asia'];
  if (c.cca2 === 'TR') return ['asia', 'europe'];
  switch (c.region) {
    case 'Africa': return ['africa'];
    case 'Asia': return ['asia'];
    case 'Europe': return ['europe'];
    case 'Oceania': return ['oceania'];
    case 'Americas': return [c.subregion === 'South America' ? 'south-america' : 'north-america'];
    default: throw new Error(`Unbekannte Region ${c.region} für ${c.cca2}`);
  }
}

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const places = JSON.parse(readFileSync('data-src/raw/ne_10m_populated_places_simple.geojson', 'utf8')).features.map((f) => f.properties);
const neCountries = JSON.parse(readFileSync('data-src/raw/ne_50m_admin_0_countries.geojson', 'utf8')).features.map((f) => f.properties);

// Coordinates Natural Earth lacks or has outdated (checked by hand).
const CAPITAL_OVERRIDES = {
  BI: { name: 'Gitega', lat: -3.4271, lng: 29.9246 },
  NR: { name: 'Yaren', lat: -0.5477, lng: 166.9209 },
  PS: { name: 'Ramallah', lat: 31.9038, lng: 35.2034 },
  XK: { name: 'Pristina', lat: 42.6629, lng: 21.1655 },
  TW: { name: 'Taipei', lat: 25.033, lng: 121.5654 },
  PR: { name: 'San Juan', lat: 18.4655, lng: -66.1057 },
  KZ: { name: 'Astana', lat: 51.1605, lng: 71.4704 },
};

const byIso3 = new Map(worldCountries.map((c) => [c.cca3, c.cca2]));
const selected = worldCountries.filter((c) => (c.unMember && c.cca2 !== 'VA') || EXTRA[c.cca2]);

const report = [];
const out = selected
  .map((c) => {
    const iso2 = c.cca2;
    const capitalName = c.capital && c.capital[0];
    let capital = CAPITAL_OVERRIDES[iso2];
    if (!capital) {
      const cands = places.filter(
        (p) => (p.adm0cap === 1 || p.featurecla === 'Admin-0 capital' || p.featurecla === 'Admin-0 capital alt') && (p.iso_a2 === iso2 || p.adm0_a3 === c.cca3),
      );
      const exact = cands.find((p) => norm(p.name) === norm(capitalName) || norm(p.nameascii) === norm(capitalName) || norm(p.namealt).includes(norm(capitalName)));
      const pick = exact || (cands.length === 1 ? cands[0] : null);
      if (!pick) {
        const loose = places.find((p) => (p.iso_a2 === iso2 || p.adm0_a3 === c.cca3) && (norm(p.name) === norm(capitalName) || norm(p.nameascii) === norm(capitalName)));
        if (loose) capital = { name: capitalName, lat: loose.latitude, lng: loose.longitude };
        else report.push(`${iso2}: keine Koordinaten für "${capitalName}" (Kandidaten: ${cands.map((p) => p.name).join(', ') || '–'})`);
      } else {
        if (!exact) report.push(`${iso2}: "${capitalName}" ≠ NE "${pick.name}" – bitte prüfen`);
        capital = { name: capitalName, lat: pick.latitude, lng: pick.longitude };
      }
    }
    const ne = neCountries.find((p) => p.ISO_A2_EH === iso2 || p.ISO_A2 === iso2 || p.ADM0_A3 === c.cca3);
    if (!ne) report.push(`${iso2}: keine Einwohnerzahl (Natural Earth)`);

    return {
      iso2,
      iso3: c.cca3,
      ccn3: c.ccn3 || null,
      status: EXTRA[iso2] || 'un',
      name: {
        de: c.translations.deu.common,
        en: c.name.common,
        es: c.translations.spa.common,
        officialDe: c.translations.deu.official,
      },
      continents: continentsOf(c),
      subregion: SUBREGION_DE[c.subregion] || c.subregion || '',
      capitalHint: c.capital || [],
      capitalCoords: capital ? { lat: Math.round(capital.lat * 1e4) / 1e4, lng: Math.round(capital.lng * 1e4) / 1e4 } : null,
      center: c.latlng,
      area: c.area,
      landlocked: c.landlocked,
      borders: (c.borders || []).map((b) => byIso3.get(b)).filter(Boolean),
      population: ne ? { value: ne.POP_EST, year: ne.POP_YEAR } : null,
      languagesHint: c.languages || {},
    };
  })
  .sort((a, b) => a.name.de.localeCompare(b.name.de, 'de'));

mkdirSync('data-src', { recursive: true });
writeFileSync('data-src/base.json', `${JSON.stringify(out, null, 1)}\n`);
console.log(`${out.length} Länder geschrieben → data-src/base.json`);
console.log(report.length ? `Hinweise:\n  ${report.join('\n  ')}` : 'Keine Auffälligkeiten.');
