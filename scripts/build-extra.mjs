// Fetches up-to-date population figures from the World Bank (CC BY 4.0) and the time zone of every
// capital (IANA tz database, public domain) into data-src/extra.json.
// Run occasionally (needs internet); `npm run data` then uses the saved file, so builds work offline.
// Usage: npm run data:extra
import { readFileSync, writeFileSync } from 'node:fs';

const base = JSON.parse(readFileSync('data-src/base.json', 'utf8'));
const year = new Date().getFullYear();
const url = `https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&date=${year - 4}:${year}&per_page=5000`;

const res = await fetch(url);
if (!res.ok) throw new Error(`Weltbank-API: HTTP ${res.status}`);
const [meta, rows] = await res.json();

const latest = new Map();
for (const r of rows) {
  if (r.value == null) continue;
  const cur = latest.get(r.countryiso3code);
  if (!cur || Number(r.date) > cur.year) latest.set(r.countryiso3code, { value: r.value, year: Number(r.date) });
}

const population = {};
const missing = [];
for (const c of base) {
  const p = latest.get(c.iso3 === 'UNK' ? 'XKX' : c.iso3); // Kosovo has a different code at the World Bank
  if (p) population[c.iso2] = p;
  else missing.push(c.iso2);
}

// Time zone of the capital: of the country's zones in zone.tab, the one whose main city is nearest.
const tzRes = await fetch('https://raw.githubusercontent.com/eggert/tz/main/zone.tab');
if (!tzRes.ok) throw new Error(`zone.tab: HTTP ${tzRes.status}`);
/** "+4024" / "-00341" / "+313200" (±DDMM[SS] / ±DDDMM[SS]) → degrees */
function parseCoord(text, degLen) {
  const sign = text[0] === '-' ? -1 : 1;
  const d = text.slice(1);
  return sign * (Number(d.slice(0, degLen)) + Number(d.slice(degLen, degLen + 2)) / 60 + Number(d.slice(degLen + 2) || 0) / 3600);
}
const zones = (await tzRes.text())
  .split('\n')
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const [cc, coord, tz] = line.split('\t');
    const [, lat, lng] = coord.match(/^([+-]\d+)([+-]\d+)$/);
    return { cc, tz, lat: parseCoord(lat, 2), lng: parseCoord(lng, 3) };
  });
const timezones = {};
for (const c of base) {
  const at = c.capitalCoords ?? { lat: c.center[0], lng: c.center[1] };
  const own = zones.filter((z) => z.cc === c.iso2).sort((a, b) => Math.hypot(a.lat - at.lat, a.lng - at.lng) - Math.hypot(b.lat - at.lat, b.lng - at.lng));
  // Kosovo is not in zone.tab; it uses the same time as Serbia.
  timezones[c.iso2] = own[0]?.tz ?? (c.iso2 === 'XK' ? 'Europe/Belgrade' : null);
}
const noTz = base.filter((c) => !timezones[c.iso2]).map((c) => c.iso2);
if (noTz.length) console.log(`Ohne Zeitzone: ${noTz.join(' ')}`);

writeFileSync('data-src/extra.json', JSON.stringify({ source: 'World Bank, SP.POP.TOTL; IANA tz database', updated: meta.lastupdated, population, timezones }, null, 1) + '\n');
console.log(`Einwohnerzahlen für ${Object.keys(population).length} Länder (Weltbank, Stand ${meta.lastupdated}).`);
if (missing.length) console.log(`Nicht in der Weltbank-Statistik (bleiben beim alten Wert): ${missing.join(' ')}`);
