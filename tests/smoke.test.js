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
  }),
  registerMap: () => {},
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
  { name: 'heatmapView',  path: '../js/views/heatmapView.js',  dom: {} },
  { name: 'timelineView', path: '../js/views/timelineView.js', dom: {} },
  { name: 'parallelView', path: '../js/views/parallelView.js', dom: {} },
  { name: 'policyView',   path: '../js/views/policyView.js',   dom: {} },
  { name: 'detailView',   path: '../js/views/detailView.js',   dom: {} },
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
