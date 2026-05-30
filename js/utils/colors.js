/** Color scheme constants (per spec §6). */

// Heatmap: yellow-orange-red 5-level gradient
export const HEATMAP = ['#ffffb2','#fecc5c','#fd8d3c','#e31a1c','#800026'];

// Tableau 10 palette for multi-region lines
export const TABLEAU = [
  '#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f',
  '#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ac',
];

// Policy type colors
export const POLICY = {
  lockdown:        '#d32f2f',
  vaccination:     '#2e7d32',
  aid:             '#1565c0',
  surveillance:    '#f57c00',
  health_response: '#7b1fa2',
};

// Background
export const BG = '#f5f7fa';

// Region color cache
const regionColorMap = {};
let colorIdx = 0;

export function getRegionColor(region) {
  if (!regionColorMap[region]) {
    regionColorMap[region] = TABLEAU[colorIdx % TABLEAU.length];
    colorIdx++;
  }
  return regionColorMap[region];
}

/** Interpolate heatmap color by value in [0, 1]. */
export function heatmapColor(value) {
  const colors = HEATMAP;
  if (value <= 0) return colors[0];
  if (value >= 1) return colors[colors.length - 1];
  const idx = value * (colors.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  const t = idx - lo;
  return lerpHex(colors[lo], colors[hi], t);
}

function lerpHex(c1, c2, t) {
  const p = s => [parseInt(s.slice(1,3),16), parseInt(s.slice(3,5),16), parseInt(s.slice(5,7),16)];
  const [r1,g1,b1] = p(c1), [r2,g2,b2] = p(c2);
  const r = Math.round(r1+(r2-r1)*t), g = Math.round(g1+(g2-g1)*t), b = Math.round(b1+(b2-b1)*t);
  return `rgb(${r},${g},${b})`;
}
