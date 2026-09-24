// Fetches up-to-date population figures from the World Bank (CC BY 4.0) into data-src/extra.json.
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

writeFileSync('data-src/extra.json', JSON.stringify({ source: 'World Bank, SP.POP.TOTL', updated: meta.lastupdated, population }, null, 1) + '\n');
console.log(`Einwohnerzahlen für ${Object.keys(population).length} Länder (Weltbank, Stand ${meta.lastupdated}).`);
if (missing.length) console.log(`Nicht in der Weltbank-Statistik (bleiben beim alten Wert): ${missing.join(' ')}`);
