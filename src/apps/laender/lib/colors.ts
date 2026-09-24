/** Colours used on the map (and in the legend). */
export const MAP_COLORS = {
  focus: '#fcc419',
  set: '#2dd4bf',
  neighbor: '#e9d8fd',
  correct: '#40c057',
  wrong: '#fa5252',
};

/** Red → amber → green for 0 … 1 (learning progress). */
export function heatColor(v: number): string {
  const stops = [
    [0, [250, 82, 82]],
    [0.5, [252, 196, 25]],
    [1, [64, 192, 87]],
  ] as const;
  const t = Math.max(0, Math.min(1, v));
  const [a, b] = t <= 0.5 ? [stops[0], stops[1]] : [stops[1], stops[2]];
  const k = (t - a[0]) / (b[0] - a[0]);
  const c = a[1].map((x, i) => Math.round(x + (b[1][i] - x) * k));
  return `rgb(${c.join(',')})`;
}
