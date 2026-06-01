/**
 * Smoke test: verify all 5 views initialize without throwing.
 *
 * Mocks the ECharts global so we can run in Node.js — catches
 * ReferenceErrors, import failures, and data-load issues BEFORE
 * the browser.
 *
 * Usage:
 *   node tests/smoke.test.js
 *
 * Expected output: ✅ All 5 views initialized and destroyed successfully
 */

import { readFileSync } from 'node:fs';

// ── Mock ECharts (lightweight — just enough so views don't crash) ──
globalThis.echarts = {
  init: () => ({
    setOption: () => {},
    on: () => {},
    resize: () => {},
    dispose: () => {},
    getModel: () => ({}),
    dispatchAction: () => {},
    getZr: () => ({ on: () => {} }),
    getWidth: () => 600,
    getHeight: () => 450,
    getOption: () => ({ series: [{ id: 'base-series', center: [29.5, -0.2], zoom: 1.4 }] }),
  }),
  registerMap: () => {},
};

// Mock document for views that manipulate DOM (heatmap detail panel, parallel clear button)
function createFakeDom() {
  const style = {};
  const children = [];
  let _innerHTML = '';
  const el = {
    style,
    get innerHTML() { return _innerHTML; },
    set innerHTML(v) { _innerHTML = v; },
    addEventListener: () => {},
    removeEventListener: () => {},
    remove: () => {},
    appendChild: (child) => { children.push(child); },
    // detailView uses querySelector('#detail-cards') and ('#detail-bars')
    querySelector: (sel) => createFakeDom(),
  };
  return el;
}

globalThis.document = {
  getElementById: (id) => {
    if (id === 'chart-heatmap-detail') return createFakeDom();
    return createFakeDom();  // parallel, timeline, etc. all get a fake dom
  },
  createElement: (tag) => {
    const el = {
      tagName: tag,
      style: {},
      textContent: '',
      addEventListener: () => {},
      removeEventListener: () => {},
      remove: () => {},
      appendChild: () => {},
    };
    return el;
  },
};

// ── Load data (same files the browser fetches at runtime) ──
function load(name, relPath) {
  try {
    return JSON.parse(readFileSync(relPath, 'utf8'));
  } catch (e) {
    console.error(`  ❌ Cannot load ${name}: ${e.message}`);
    process.exit(1);
  }
}

const data = {
  cases:               load('cases',               'data/cases_by_region_date.json'),
  demographics:        load('demographics',        'data/demographics.json'),
  policies:            load('policies',            'data/policy_events.json'),
  borderPoE:           load('borderPoE',           'data/border_poe.json'),
  geoOutbreak:         load('geoOutbreak',         'data/geo/outbreak_region.geojson'),
  ugaDistrictRegion:   load('ugaDistrictRegion',   'data/geo/uga_district_region_map.json'),
  zoneCoords:          load('zoneCoords',          'data/zone_coords.json'),
};

// ── Bootstrap Store ──
const { createStore, reducer, getInitialState } = await import('../js/store.js');
const { getTimeRange } = await import('../js/utils/dataLoader.js');
const fullTimeRange = getTimeRange(data.cases);
const store = createStore(reducer, getInitialState(fullTimeRange));

// ── Initialize all 5 views ──
let pass = 0, fail = 0;
const results = [];

const modules = [
  { name: 'heatmapView',  path: '../js/views/heatmapView.js',  dom: createFakeDom() },
  { name: 'timelineView', path: '../js/views/timelineView.js', dom: createFakeDom() },
  { name: 'parallelView', path: '../js/views/parallelView.js', dom: createFakeDom() },
  { name: 'policyView',   path: '../js/views/policyView.js',   dom: createFakeDom() },
  { name: 'detailView',   path: '../js/views/detailView.js',   dom: createFakeDom() },
];

for (const m of modules) {
  try {
    const mod = await import(m.path);
    const initFn = mod[`init${m.name.charAt(0).toUpperCase() + m.name.slice(1)}`]
                || mod[`init${m.name.replace('View', '')}View`];
    // Find the init function
    const fnName = Object.keys(mod).find(k => k.startsWith('init'));
    if (!fnName) throw new Error('No init function exported');
    const view = mod[fnName](m.dom, store, data);
    if (!view || typeof view.destroy !== 'function') {
      throw new Error('init() must return { destroy }');
    }
    view.destroy();
    pass++;
    results.push(`  ✅ ${m.name}`);
  } catch (e) {
    fail++;
    results.push(`  ❌ ${m.name}: ${e.message}`);
  }
}

// ── Report ──
console.log('\n── Smoke Test Results ──');
for (const r of results) console.log(r);

if (fail > 0) {
  console.log(`\n❌ ${fail} FAILED, ${pass} passed`);
  process.exit(1);
}
console.log(`\n✅ All ${pass} views initialized and destroyed successfully`);
