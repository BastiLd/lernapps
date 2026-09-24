// Builds dist/ only when something changed since the last build (used by start.bat – a full build
// takes a few minutes in OneDrive, starting the already built app takes seconds).
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STAMP = 'dist/.build-stamp';
const INPUTS = ['src', 'public', 'index.html', 'laender', 'vite.config.ts', 'package.json', 'tsconfig.json'];

function newest(path) {
  if (!existsSync(path)) return 0;
  const st = statSync(path);
  if (!st.isDirectory()) return st.mtimeMs;
  let max = st.mtimeMs;
  for (const name of readdirSync(path)) max = Math.max(max, newest(join(path, name)));
  return max;
}

const built = existsSync(STAMP) ? statSync(STAMP).mtimeMs : 0;
const changed = Math.max(...INPUTS.map(newest));
if (built && changed <= built) {
  console.log('Die gebaute Version ist aktuell – kein neuer Build nötig.');
} else {
  console.log('Baue die aktuelle Version …');
  console.log('(Liegt der Ordner in OneDrive, kann das einige Minuten dauern – bitte nicht abbrechen)');
  execSync('npm run build', { stdio: 'inherit' });
  writeFileSync(STAMP, new Date().toISOString());
}
