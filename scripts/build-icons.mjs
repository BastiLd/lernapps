// Renders public/favicon.svg into the PNG icons needed for installing the app on phones.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync('public/favicon.svg', 'utf8');
mkdirSync('public/icons', { recursive: true });

function render(source, size, file) {
  const png = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(file, png);
  console.log(`${file} (${size}px)`);
}

render(svg, 192, 'public/icons/icon-192.png');
render(svg, 512, 'public/icons/icon-512.png');

// Maskable icons need the artwork inside the central 80 % "safe zone" on a full-bleed background.
const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#1e40af"/>
  <g transform="translate(9.6 9.6) scale(0.7)">${inner}</g>
</svg>`;
render(maskable, 512, 'public/icons/maskable-512.png');
