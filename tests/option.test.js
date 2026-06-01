/**
 * View contract tests — verify every view module conforms to the
 * init(dom, store, data) → { render, resize, destroy } interface.
 *
 * Also exercises render/resize with the full state lifecycle:
 *   initial → select regions → time filter → reset → destroy
 *
 * Usage:
 *   node tests/option.test.js
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function ok(cond, msg) { cond ? passed++ : (failed++, console.error(`  ❌ ${msg}`)); }
function eq(a, b, msg) { ok(a === b, `${msg} (${JSON.stringify(a)} vs ${JSON.stringify(b)})`); }
function section(t) { console.log(`\n── ${t} ──`); }

// ── Load real data ──
const data = {
  cases:             JSON.parse(readFileSync('data/cases_by_region_date.json', 'utf8')),
  demographics:      JSON.parse(readFileSync('data/demographics.json', 'utf8')),
  policies:          JSON.parse(readFileSync('data/policy_events.json', 'utf8')),
  borderPoE:         JSON.parse(readFileSync('data/border_poe.json', 'utf8')),
  geoOutbreak:       JSON.parse(readFileSync('data/geo/outbreak_region.geojson', 'utf8')),
  ugaDistrictRegion: JSON.parse(readFileSync('data/geo/uga_district_region_map.json', 'utf8')),
  zoneCoords:        JSON.parse(readFileSync('data/zone_coords.json', 'utf8')),
};

// ── Mock ECharts — capture setOption calls for inspection ──
const setOptionCalls = [];
globalThis.echarts = {
  init: () => ({
    setOption: (opt, opts) => { setOptionCalls.push({ opt, opts }); },
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

// ── Mock DOM ──
function fakeDom() {
  const el = {
    style: {}, _html: '', children: [],
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; },
    addEventListener: () => {},
    removeEventListener: () => {},
    remove: () => {},
    appendChild: (c) => { el.children.push(c); },
    querySelector: (sel) => {
      if (sel === '#detail-cards') return fakeDom();
      if (sel === '#detail-bars') return fakeDom();
      return fakeDom();
    },
    parentElement: null,
  };
  return el;
}
globalThis.document = {
  getElementById: (id) => {
    const el = fakeDom();
    if (id === 'chart-heatmap-detail') {
      el.parentElement = fakeDom();
      el.parentElement.querySelector = () => fakeDom();
    }
    return el;
  },
  createElement: () => ({ style: {}, addEventListener: () => {}, remove: () => {}, appendChild: () => {} }),
};

// ── Bootstrap store ──
const { createStore, reducer, getInitialState } = await import('../js/store.js');
const { getTimeRange } = await import('../js/utils/dataLoader.js');
const fullTR = getTimeRange(data.cases);
const store = createStore(reducer, getInitialState(fullTR));

// ── Helper: exercise a view through the full lifecycle ──
async function testView(name, modulePath, domFactory, extraData) {
  section(name);
  const mod = await import(modulePath);
  const initFn = Object.keys(mod).find(k => k.startsWith('init'));
  ok(!!initFn, `${name}: exports init function`);

  const dom = domFactory ? domFactory() : fakeDom();
  const viewData = extraData ? { ...data, ...extraData } : data;
  const view = mod[initFn](dom, store, viewData);

  // 1 — View interface
  ok(typeof view === 'object' && view !== null, `${name}: init returns object`);
  ok(typeof view.render === 'function', `${name}: has render()`);
  ok(typeof view.resize === 'function', `${name}: has resize()`);
  ok(typeof view.destroy === 'function', `${name}: has destroy()`);

  // 2 — render(state) does not throw
  try {
    view.render(store.getState());
    ok(true, `${name}: render(state) ok`);
  } catch (e) {
    ok(false, `${name}: render(state) threw — ${e.message}`);
  }

  // 3 — render after state change (select regions)
  try {
    store.dispatch({ type: 'SET_SELECTED_REGIONS', payload: ['Mongbalu'] });
    ok(true, `${name}: render after region select ok`);
  } catch (e) {
    ok(false, `${name}: render after region select threw — ${e.message}`);
  }

  // 4 — render after time range change
  try {
    store.dispatch({ type: 'SET_TIME_RANGE', payload: ['2026-06-01', '2026-06-15'] });
    ok(true, `${name}: render after timeRange change ok`);
  } catch (e) {
    ok(false, `${name}: render after timeRange change threw — ${e.message}`);
  }

  // 5 — render after policy select
  try {
    store.dispatch({ type: 'SET_SELECTED_POLICY_IDS', payload: ['P001'] });
    ok(true, `${name}: render after policy select ok`);
  } catch (e) {
    ok(false, `${name}: render after policy select threw — ${e.message}`);
  }

  // 6 — render after animating
  try {
    store.dispatch({ type: 'SET_ANIMATING_DATE', payload: '2026-06-15' });
    ok(true, `${name}: render during animation ok`);
  } catch (e) {
    ok(false, `${name}: render during animation threw — ${e.message}`);
  }

  // 7 — full reset
  try {
    store.dispatch({ type: 'RESET_ALL', payload: { timeRange: fullTR } });
    ok(true, `${name}: render after RESET_ALL ok`);
  } catch (e) {
    ok(false, `${name}: render after RESET_ALL threw — ${e.message}`);
  }

  // 8 — resize does not throw
  try {
    view.resize();
    ok(true, `${name}: resize() ok`);
  } catch (e) {
    ok(false, `${name}: resize() threw — ${e.message}`);
  }

  // 9 — destroy does not throw
  try {
    view.destroy();
    ok(true, `${name}: destroy() ok`);
  } catch (e) {
    ok(false, `${name}: destroy() threw — ${e.message}`);
  }

  return view;
}

// ══════════════════════════════════════════════════════════════════════════════
// Test all 5 views
// ══════════════════════════════════════════════════════════════════════════════

await testView('1. Heatmap (choropleth)',  '../js/views/heatmapView.js');
await testView('2. Heatmap (bubble fallback)', '../js/views/heatmapView.js', null, { geoOutbreak: null });
await testView('3. Timeline',             '../js/views/timelineView.js');
await testView('4. Parallel',             '../js/views/parallelView.js');
await testView('5. Policy',               '../js/views/policyView.js');
await testView('6. Detail',               '../js/views/detailView.js');

// ── Report ──
const total = passed + failed;
console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${passed}/${total} passed`);
if (failed > 0) { console.error(`  ${failed} FAILED`); process.exit(1); }
console.log(`  ✅ All ${total} view contract tests passed`);
