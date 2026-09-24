// Merges data-src/base.json (open datasets) with data-src/content/*.json (written + fact-checked texts)
// into the files the app imports: src/apps/laender/data/{countries,languages}.json and flags/*.svg.
// Usage: node scripts/build-data.mjs [--strict]   (--strict fails if any country has no content)
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const worldCountries = new Map(require('world-countries').map((c) => [c.cca2, c]));

const STRICT = process.argv.includes('--strict');
const OUT = 'src/apps/laender/data';
const base = JSON.parse(readFileSync('data-src/base.json', 'utf8'));
const inApp = new Set(base.map((c) => c.iso2));
// Newer population figures (World Bank, `npm run data:extra`); countries it doesn't cover keep the base value.
const extra = existsSync('data-src/extra.json') ? JSON.parse(readFileSync('data-src/extra.json', 'utf8')) : { population: {} };

// world-countries lists some outdated or merely tolerated currencies – these are the ones in use (2026).
const CURRENCY_OVERRIDES = { BG: ['EUR'], SL: ['SLE'], ZW: ['ZWG', 'USD'], CU: ['CUP'], KI: ['AUD'], TV: ['AUD'], PS: ['ILS', 'JOD'], FM: ['USD'] };
const currencyDe = new Intl.DisplayNames('de', { type: 'currency' });
const currencyEs = new Intl.DisplayNames('es', { type: 'currency' });

const symbolOf = (code) => new Intl.NumberFormat('de', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency')?.value;

function currenciesOf(iso2) {
  const wc = worldCountries.get(iso2);
  const codes = CURRENCY_OVERRIDES[iso2] ?? Object.keys(wc?.currencies ?? {}).slice(0, 2);
  return codes.map((code) => ({ code, de: currencyDe.of(code), es: currencyEs.of(code), symbol: symbolOf(code) ?? code }));
}

function phoneOf(iso2) {
  const idd = worldCountries.get(iso2)?.idd;
  if (!idd?.root) return null;
  return idd.suffixes?.length === 1 ? idd.root + idd.suffixes[0] : idd.root;
}

const content = new Map();
const languages = {};
const warnings = [];
for (const file of readdirSync('data-src/content').filter((f) => /^batch-\d+\.json$/.test(f)).sort()) {
  const d = JSON.parse(readFileSync(`data-src/content/${file}`, 'utf8'));
  for (const [code, names] of Object.entries(d.languageNames || {})) {
    if (!languages[code]) languages[code] = names;
    else if (languages[code].de !== names.de) warnings.push(`Sprache ${code}: "${languages[code].de}" vs. "${names.de}" (${file})`);
  }
  for (const c of d.countries || []) content.set(c.iso2, c);
}

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const round4 = (n) => Math.round(n * 1e4) / 1e4;
const missingContent = [];

const countries = base.map((b) => {
  const c = content.get(b.iso2);
  if (!c) missingContent.push(b.iso2);

  let capital;
  if (c) {
    const nameMatch = b.capitalHint.some((h) => [c.capital.en, c.capital.de, c.capital.es].some((n) => norm(n) === norm(h)));
    const dist = b.capitalCoords ? distanceKm(b.capitalCoords, c.capital) : Infinity;
    const sameCity = Boolean(b.capitalCoords) && (nameMatch || dist < 25);
    const coords = sameCity ? b.capitalCoords : { lat: c.capital.lat, lng: c.capital.lng };
    if (sameCity) {
      if (dist > 40) warnings.push(`${b.iso2}: Hauptstadt-Koordinaten weichen ${Math.round(dist)} km ab (Natural Earth genutzt)`);
    } else {
      warnings.push(`${b.iso2}: Hauptstadt "${c.capital.de}" statt Datensatz "${b.capitalHint.join('/')}" – Koordinaten aus Inhalt`);
    }
    capital = { de: c.capital.de, es: c.capital.es, en: c.capital.en, lat: round4(coords.lat), lng: round4(coords.lng) };
  } else {
    const n = b.capitalHint[0] || '–';
    capital = { de: n, es: n, en: n, lat: b.capitalCoords?.lat ?? b.center[0], lng: b.capitalCoords?.lng ?? b.center[1] };
  }

  return {
    iso2: b.iso2,
    iso3: b.iso3,
    status: b.status,
    name: c ? c.name : { de: b.name.de, es: b.name.es, en: b.name.en },
    aliases: c ? c.aliases.filter((a) => ![c.name.de, c.name.es, c.name.en].includes(a)) : [b.name.officialDe],
    capital,
    capitalNote: c?.capitalNote ?? null,
    otherCapitals: (c?.otherCapitals || []).map((o) => ({ de: o.de, es: o.es, en: o.en, role: o.role, lat: round4(o.lat), lng: round4(o.lng) })),
    continents: b.continents,
    subregion: b.subregion,
    languages: c ? c.languages : { official: [], regional: [], spoken: [] },
    languageNote: c?.languageNote ?? null,
    demonym: c?.demonym ?? null,
    history: c?.history ?? null,
    culture: c?.culture ?? null,
    funFact: c?.funFact ?? null,
    population: extra.population[b.iso2] ?? b.population,
    currencies: currenciesOf(b.iso2),
    phone: phoneOf(b.iso2),
    tld: worldCountries.get(b.iso2)?.tld?.[0] ?? null,
    area: b.area,
    landlocked: b.landlocked,
    borders: b.borders.filter((x) => inApp.has(x)),
    center: b.center,
    small: b.area < 5000,
  };
});

if (missingContent.length) {
  const msg = `Noch ohne Inhalte (${missingContent.length}): ${missingContent.join(' ')}`;
  if (STRICT) throw new Error(msg);
  warnings.push(msg);
}
const usedCodes = new Set(countries.flatMap((c) => [...c.languages.official, ...c.languages.regional, ...c.languages.spoken]));
for (const code of usedCodes) if (!languages[code]) warnings.push(`Sprachname fehlt für Code "${code}"`);
const langOut = Object.fromEntries([...usedCodes].filter((c) => languages[c]).sort().map((c) => [c, languages[c]]));

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/countries.json`, JSON.stringify(countries));
writeFileSync(`${OUT}/languages.json`, JSON.stringify(langOut));

const flagDir = `${OUT}/flags`;
if (existsSync(flagDir)) rmSync(flagDir, { recursive: true });
mkdirSync(flagDir, { recursive: true });
for (const c of countries) {
  const src = `node_modules/flag-icons/flags/4x3/${c.iso2.toLowerCase()}.svg`;
  if (!existsSync(src)) throw new Error(`Keine Flagge für ${c.iso2}`);
  copyFileSync(src, `${flagDir}/${c.iso2}.svg`);
}

console.log(`${countries.length} Länder, ${Object.keys(langOut).length} Sprachen, ${countries.length} Flaggen → ${OUT}`);
if (warnings.length) console.log(`Hinweise (${warnings.length}):\n  ${warnings.join('\n  ')}`);
