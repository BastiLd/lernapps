// Validates data-src/content/batch-*.json against data-src/batches.json.
// Usage: node scripts/check-content.mjs [--json]
import { readFileSync, existsSync } from 'node:fs';

const batches = JSON.parse(readFileSync('data-src/batches.json', 'utf8'));
const asJson = process.argv.includes('--json');

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
// Counts sentence ends, ignoring ordinals ("19. Jahrhundert") and common abbreviations ("v. Chr.", "z. B.").
const ABBR = /(?:\b(?:z|B|v|n|Chr|u|a|d|h|Jh|Jhd|bzw|ca|St|Dr|Nr|vgl|etc|usw|u\.a|v\.a|s)\.)$/;
const sentences = (s) => {
  let n = 0;
  const re = /[.!?…](?=\s+[„"(]?[A-ZÄÖÜ]|\s*$)/g;
  let m;
  while ((m = re.exec(s))) {
    const before = s.slice(0, m.index + 1);
    if (/\d\.$/.test(before) || ABBR.test(before)) continue;
    n++;
  }
  return n;
};

function checkCountry(c, languageNames) {
  const e = [];
  for (const k of ['de', 'es', 'en']) {
    if (!isStr(c.name?.[k])) e.push(`name.${k}`);
    if (!isStr(c.capital?.[k])) e.push(`capital.${k}`);
  }
  if (!isNum(c.capital?.lat) || !isNum(c.capital?.lng)) e.push('capital.lat/lng');
  if (!Array.isArray(c.aliases)) e.push('aliases');
  if (!(c.capitalNote === null || isStr(c.capitalNote))) e.push('capitalNote');
  if (!Array.isArray(c.otherCapitals)) e.push('otherCapitals');
  else
    c.otherCapitals.forEach((o, i) => {
      if (!isStr(o.de) || !isStr(o.es) || !isStr(o.en) || !isStr(o.role) || !isNum(o.lat) || !isNum(o.lng)) e.push(`otherCapitals[${i}]`);
    });
  const L = c.languages || {};
  const seen = new Set();
  for (const k of ['official', 'regional', 'spoken']) {
    if (!Array.isArray(L[k])) {
      e.push(`languages.${k}`);
      continue;
    }
    for (const code of L[k]) {
      if (seen.has(code)) e.push(`Sprachcode ${code} doppelt`);
      seen.add(code);
      if (!languageNames?.[code]) e.push(`languageNames fehlt ${code}`);
    }
  }
  if (Array.isArray(L.official) && L.official.length === 0) e.push('keine Amtssprache');
  if (!(c.languageNote === null || isStr(c.languageNote))) e.push('languageNote');
  for (const k of ['deM', 'deF', 'esM', 'esF']) if (!isStr(c.demonym?.[k])) e.push(`demonym.${k}`);
  for (const k of ['history', 'culture']) {
    if (!isStr(c[k])) e.push(k);
    else if (sentences(c[k]) < 2 || sentences(c[k]) > 5) e.push(`${k}: ${sentences(c[k])} Sätze`);
  }
  if (!isStr(c.funFact)) e.push('funFact');
  return e;
}

const report = [];
for (const b of batches) {
  const file = `data-src/content/batch-${b.id}.json`;
  const expected = b.countries.map((c) => c.iso2);
  const r = { id: b.id, file, status: 'ok', problems: [] };
  if (!existsSync(file)) {
    r.status = 'missing';
    report.push(r);
    continue;
  }
  let d;
  try {
    d = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    r.status = 'invalid-json';
    r.problems.push(err.message);
    report.push(r);
    continue;
  }
  const got = (d.countries || []).map((c) => c.iso2);
  const missing = expected.filter((x) => !got.includes(x));
  const extra = got.filter((x) => !expected.includes(x));
  if (missing.length) r.problems.push(`fehlende Länder: ${missing.join(' ')}`);
  if (extra.length) r.problems.push(`unerwartete Länder: ${extra.join(' ')}`);
  for (const c of d.countries || []) {
    const e = checkCountry(c, d.languageNames);
    if (e.length) r.problems.push(`${c.iso2}: ${e.join(', ')}`);
  }
  for (const [code, n] of Object.entries(d.languageNames || {})) {
    if (!isStr(n?.de) || !isStr(n?.es) || !isStr(n?.en)) r.problems.push(`languageNames.${code} unvollständig`);
  }
  if (missing.length || extra.length) r.status = 'incomplete';
  else if (r.problems.length) r.status = 'problems';
  report.push(r);
}

if (asJson) console.log(JSON.stringify(report));
else
  for (const r of report) {
    console.log(`${r.id} ${r.status}${r.problems.length ? `\n   - ${r.problems.join('\n   - ')}` : ''}`);
  }
