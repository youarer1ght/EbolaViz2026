/**
 * Unit tests — pure-logic modules (store, actions, colors, dataLoader).
 *
 * These tests exercise the data pipeline that feeds all 5 views:
 *   filterCases → summarizeByRegion/Province → getRegionColor / heatmapColor
 *   store.dispatch(action) → reducer → subscribe → views render
 *
 * Usage:
 *   node tests/unit.test.js
 */

import { createRequire } from 'node:module';

// ── Test helpers ──
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; return; }
  failed++;
  console.error(`  ❌ FAIL: ${msg}`);
}
function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; return; }
  failed++;
  console.error(`  ❌ FAIL: ${msg} — expected ${e}, got ${a}`);
}
function assertDeepEq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; return; }
  failed++;
  console.error(`  ❌ FAIL: ${msg}`);
  console.error(`     expected: ${e}`);
  console.error(`     actual:   ${a}`);
}
function section(title) { console.log(`\n── ${title} ──`); }

// ── Sample data used across tests ──
const sampleCases = [
  { date: '2026-05-14', region: 'Mongbalu', country: 'COD', province: 'Ituri', new_cases: 5, new_deaths: 1, suspected_cases: 2, suspected_deaths: 0 },
  { date: '2026-05-15', region: 'Mongbalu', country: 'COD', province: 'Ituri', new_cases: 3, new_deaths: 0, suspected_cases: 1, suspected_deaths: 0 },
  { date: '2026-05-16', region: 'Mongbalu', country: 'COD', province: 'Ituri', new_cases: 0, new_deaths: 0, suspected_cases: 0, suspected_deaths: 0 },
  { date: '2026-05-14', region: 'Bunia',    country: 'COD', province: 'Ituri', new_cases: 2, new_deaths: 1, suspected_cases: 0, suspected_deaths: 0 },
  { date: '2026-08-01', region: 'Kampala',  country: 'UGA', province: '',       new_cases: 10, new_deaths: 2, suspected_cases: 3, suspected_deaths: 1 },
  { date: '2026-08-02', region: 'Kampala',  country: 'UGA', province: '',       new_cases: 8, new_deaths: 1, suspected_cases: 2, suspected_deaths: 0 },
  { date: '2026-07-15', region: 'Goma',     country: 'COD', province: 'Nord-Kivu', new_cases: 4, new_deaths: 0, suspected_cases: 1, suspected_deaths: 0 },
];

const ugaMap = { 'Kampala': 'Kampala' };

// ══════════════════════════════════════════════════════════════════════════════
// 1. STORE — createStore, reducer, getInitialState, subscribe
// ══════════════════════════════════════════════════════════════════════════════
section('1. Store');

const { createStore, reducer, getInitialState, A } = await import('../js/store.js');

// 1a — createStore returns expected API
const fullTR = ['2026-05-14', '2026-08-02'];
const store = createStore(reducer, getInitialState(fullTR));
assert(typeof store.getState === 'function', 'store.getState is function');
assert(typeof store.dispatch === 'function', 'store.dispatch is function');
assert(typeof store.subscribe === 'function', 'store.subscribe is function');

// 1b — getInitialState
const init = getInitialState(fullTR);
assertDeepEq(init.timeRange, fullTR, 'initial timeRange');
assertEq(init.animatingDate, null, 'initial animatingDate');
assertEq(init.isPlaying, false, 'initial isPlaying');
assertDeepEq(init.selectedRegions, [], 'initial selectedRegions');
assertDeepEq(init.highlightedRegions, [], 'initial highlightedRegions');
assertDeepEq(init.selectedPolicyIds, [], 'initial selectedPolicyIds');

// 1c — SET_TIME_RANGE
store.dispatch({ type: A.SET_TIME_RANGE, payload: ['2026-05-20', '2026-07-01'] });
const s1 = store.getState();
assertDeepEq(s1.timeRange, ['2026-05-20', '2026-07-01'], 'SET_TIME_RANGE');

// 1d — SET_SELECTED_REGIONS
store.dispatch({ type: A.SET_SELECTED_REGIONS, payload: ['Mongbalu', 'Bunia'] });
const s2 = store.getState();
assertDeepEq(s2.selectedRegions, ['Mongbalu', 'Bunia'], 'SET_SELECTED_REGIONS');
assertEq(s2.timeRange[0], '2026-05-20', 'other fields preserved');

// 1e — SET_HIGHLIGHTED_REGIONS
store.dispatch({ type: A.SET_HIGHLIGHTED_REGIONS, payload: ['Kampala'] });
const s3 = store.getState();
assertDeepEq(s3.highlightedRegions, ['Kampala'], 'SET_HIGHLIGHTED_REGIONS');

// 1f — SET_SELECTED_POLICY_IDS
store.dispatch({ type: A.SET_SELECTED_POLICY_IDS, payload: ['P001', 'P002'] });
const s4 = store.getState();
assertDeepEq(s4.selectedPolicyIds, ['P001', 'P002'], 'SET_SELECTED_POLICY_IDS');

// 1g — SET_ANIMATING_DATE
store.dispatch({ type: A.SET_ANIMATING_DATE, payload: '2026-06-01' });
const s5 = store.getState();
assertEq(s5.animatingDate, '2026-06-01', 'SET_ANIMATING_DATE');

// 1h — SET_IS_PLAYING
store.dispatch({ type: A.SET_IS_PLAYING, payload: true });
const s6 = store.getState();
assertEq(s6.isPlaying, true, 'SET_IS_PLAYING');

// 1i — RESET_ALL
store.dispatch({ type: A.RESET_ALL, payload: { timeRange: fullTR } });
const s7 = store.getState();
assertDeepEq(s7.timeRange, fullTR, 'RESET_ALL restores timeRange');
assertEq(s7.animatingDate, null, 'RESET_ALL clears animatingDate');
assertEq(s7.isPlaying, false, 'RESET_ALL clears isPlaying');
assertDeepEq(s7.selectedRegions, [], 'RESET_ALL clears selectedRegions');
assertDeepEq(s7.highlightedRegions, [], 'RESET_ALL clears highlightedRegions');
assertDeepEq(s7.selectedPolicyIds, [], 'RESET_ALL clears selectedPolicyIds');

  // 1j — Dispatch always notifies when reducer returns new reference
  // (reducer uses spread {...state} so every dispatch creates a new object,
  //  even for semantically-identical values like an empty array).
  {
    let callCount = 0;
    const unsub = store.subscribe(() => { callCount++; });
    store.dispatch({ type: A.SET_SELECTED_REGIONS, payload: [] });
    assertEq(callCount, 1, 'dispatch notifies even for semantically-same value');
    store.dispatch({ type: A.SET_SELECTED_REGIONS, payload: ['test'] });
    assertEq(callCount, 2, 'second dispatch notifies again');
    unsub();
    store.dispatch({ type: A.SET_SELECTED_REGIONS, payload: ['test2'] });
    assertEq(callCount, 2, 'unsubscribed listener is not called');
  }

// 1k — Multiple subscribers are notified
{
  let a = 0, b = 0;
  const u1 = store.subscribe(() => { a++; });
  const u2 = store.subscribe(() => { b++; });
  store.dispatch({ type: A.SET_HIGHLIGHTED_REGIONS, payload: ['X'] });
  assertEq(a, 1, 'subscriber 1 notified');
  assertEq(b, 1, 'subscriber 2 notified');
  u1(); u2();
}

// 1l — Reducer returns same state for unknown action
{
  const state = getInitialState(fullTR);
  const result = reducer(state, { type: 'UNKNOWN' });
  assert(result === state, 'unknown action returns same state object');
}

// 1m — Reducer does not mutate input
{
  const state = getInitialState(fullTR);
  const frozen = JSON.stringify(state);
  reducer(state, { type: A.SET_SELECTED_REGIONS, payload: ['Mongbalu'] });
  assertEq(JSON.stringify(state), frozen, 'reducer does not mutate input state');
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. ACTIONS — action creators
// ══════════════════════════════════════════════════════════════════════════════
section('2. Actions');

const actions = await import('../js/actions.js');

assertDeepEq(actions.setTimeRange(['2026-05-01', '2026-05-31']),
  { type: 'SET_TIME_RANGE', payload: ['2026-05-01', '2026-05-31'] }, 'setTimeRange');
assertDeepEq(actions.setAnimatingDate('2026-06-15'),
  { type: 'SET_ANIMATING_DATE', payload: '2026-06-15' }, 'setAnimatingDate');
assertDeepEq(actions.setIsPlaying(true),
  { type: 'SET_IS_PLAYING', payload: true }, 'setIsPlaying');
assertDeepEq(actions.setSelectedRegions(['Mongbalu', 'Bunia']),
  { type: 'SET_SELECTED_REGIONS', payload: ['Mongbalu', 'Bunia'] }, 'setSelectedRegions');
assertDeepEq(actions.setHighlightedRegions(['Kampala']),
  { type: 'SET_HIGHLIGHTED_REGIONS', payload: ['Kampala'] }, 'setHighlightedRegions');
assertDeepEq(actions.setSelectedPolicyIds(['P001']),
  { type: 'SET_SELECTED_POLICY_IDS', payload: ['P001'] }, 'setSelectedPolicyIds');
assertDeepEq(actions.resetAll(['2026-05-14', '2026-08-15']),
  { type: 'RESET_ALL', payload: { timeRange: ['2026-05-14', '2026-08-15'] } }, 'resetAll');
assertDeepEq(actions.setSelectedRegions([]),
  { type: 'SET_SELECTED_REGIONS', payload: [] }, 'setSelectedRegions empty array');

// ══════════════════════════════════════════════════════════════════════════════
// 3. COLORS — getRegionColor, heatmapColor, constants
// ══════════════════════════════════════════════════════════════════════════════
section('3. Colors');

const colors = await import('../js/utils/colors.js');

// 3a — getRegionColor returns consistent colors
const c1 = colors.getRegionColor('Mongbalu');
const c2 = colors.getRegionColor('Mongbalu');
assertEq(c1, c2, 'getRegionColor is idempotent');

// 3b — Different regions get different colors
const cBunia = colors.getRegionColor('Bunia');
assert(c1 !== cBunia, 'different regions get different colors');

// 3c — Color is from TABLEAU palette
assert(colors.TABLEAU.includes(c1), 'getRegionColor returns TABLEAU color');

// 3d — heatmapColor extremes
assertEq(colors.heatmapColor(0), colors.HEATMAP[0], 'heatmapColor(0) = first color');
assertEq(colors.heatmapColor(1), colors.HEATMAP[4], 'heatmapColor(1) = last color');

// 3e — heatmapColor middle returns rgb string
const mid = colors.heatmapColor(0.5);
assert(typeof mid === 'string', 'heatmapColor(0.5) returns string');
assert(mid.startsWith('rgb('), 'heatmapColor(0.5) returns rgb()');

// 3f — POLICY has all types with correct colors
assert('lockdown' in colors.POLICY, 'POLICY has lockdown');
assert('vaccination' in colors.POLICY, 'POLICY has vaccination');
assert('aid' in colors.POLICY, 'POLICY has aid');
assert('surveillance' in colors.POLICY, 'POLICY has surveillance');
assert('health_response' in colors.POLICY, 'POLICY has health_response');
assertEq(colors.POLICY.lockdown, '#d32f2f', 'lockdown = red');

// 3g — TABLEAU has 10 entries, HEATMAP has 5
assertEq(colors.TABLEAU.length, 10, 'TABLEAU has 10 colors');
assertEq(colors.HEATMAP.length, 5, 'HEATMAP has 5 colors');

// ══════════════════════════════════════════════════════════════════════════════
// 4. DATALOADER — filterCases, aggregateByRegion, summarizeByRegion,
//    summarizeByProvince, getTimeRange, getAllRegions
// ══════════════════════════════════════════════════════════════════════════════
section('4. DataLoader');

const dl = await import('../js/utils/dataLoader.js');

// 4a — getTimeRange
assertDeepEq(dl.getTimeRange(sampleCases), ['2026-05-14', '2026-08-02'], 'getTimeRange');
assertDeepEq(dl.getTimeRange([]), ['2026-05-01', '2026-05-31'], 'empty → fallback');
assertDeepEq(dl.getTimeRange(null), ['2026-05-01', '2026-05-31'], 'null → fallback');

// 4b — getAllRegions
assertDeepEq(dl.getAllRegions(sampleCases),
  ['Bunia', 'Goma', 'Kampala', 'Mongbalu'], 'getAllRegions sorted');
assertDeepEq(dl.getAllRegions(null), [], 'getAllRegions null → []');
assertDeepEq(dl.getAllRegions([]), [], 'getAllRegions empty → []');

// 4c — filterCases null/empty
assertDeepEq(dl.filterCases(null, {}), [], 'filterCases null → []');
assertDeepEq(dl.filterCases([], {}), [], 'filterCases empty → []');

// 4d — filterCases by timeRange
{
  const state = { timeRange: ['2026-07-01', '2026-08-15'], selectedRegions: [], animatingDate: null };
  const r = dl.filterCases(sampleCases, state);
  assertEq(r.length, 3, 'timeRange filter → 3 records');
}

// 4e — filterCases by selectedRegions
{
  const state = { timeRange: null, selectedRegions: ['Mongbalu'], animatingDate: null };
  const r = dl.filterCases(sampleCases, state);
  assertEq(r.length, 3, 'region filter → 3 Mongbalu records');
  assert(r.every(c => c.region === 'Mongbalu'), 'all records are Mongbalu');
}

// 4f — filterCases AND logic (timeRange + selectedRegions)
{
  const state = { timeRange: ['2026-05-14', '2026-05-15'], selectedRegions: ['Mongbalu'], animatingDate: null };
  const r = dl.filterCases(sampleCases, state);
  assertEq(r.length, 2, 'time + region AND → 2 records');
}

// 4g — filterCases animatingDate overrides timeRange
{
  const state = { timeRange: ['2026-05-01', '2026-08-15'], selectedRegions: [], animatingDate: '2026-08-01' };
  const r = dl.filterCases(sampleCases, state);
  assertEq(r.length, 1, 'animatingDate overrides → 1 record');
  assertEq(r[0].region, 'Kampala', 'correct record');
}

// 4h — filterCases memoization (same params → same reference)
{
  const state = { timeRange: ['2026-05-14', '2026-05-30'], selectedRegions: [], animatingDate: null };
  const r1 = dl.filterCases(sampleCases, state);
  const r2 = dl.filterCases(sampleCases, state);
  assert(r1 === r2, 'memoization: same reference returned');
}

// 4i — filterCases cache bust on different params
{
  const s1 = { timeRange: ['2026-05-14', '2026-05-30'], selectedRegions: [], animatingDate: null };
  const s2 = { timeRange: ['2026-07-01', '2026-08-15'], selectedRegions: [], animatingDate: null };
  const r1 = dl.filterCases(sampleCases, s1);
  const r2 = dl.filterCases(sampleCases, s2);
  assert(r1 !== r2, 'cache bust: different timeRange → different result');
  assertEq(r1.length, 4, 'May: 4 records');
  assertEq(r2.length, 3, 'Jul-Aug: 3 records');
}

// 4j — filterCases handles null timeRange / null selectedRegions
{
  const state = { timeRange: null, selectedRegions: null, animatingDate: null };
  const r = dl.filterCases(sampleCases, state);
  assertEq(r.length, 7, 'null filters → all 7 records');
}

// 4k — aggregateByRegion
{
  const agg = dl.aggregateByRegion(sampleCases);
  assertEq(Object.keys(agg).length, 4, '4 unique regions');
  assertEq(agg['Mongbalu'].length, 3, 'Mongbalu: 3 records, sorted');
}

// 4l — summarizeByRegion
{
  const summary = dl.summarizeByRegion(sampleCases);
  const m = summary['Mongbalu'];
  assertEq(m.totalConfirmed, 8, 'Mongbalu confirmed = 8');
  assertEq(m.totalDeaths, 1, 'Mongbalu deaths = 1');
  assertEq(m.totalSuspected, 3, 'Mongbalu suspected = 3');
  assertEq(m.dateCount, 3, 'Mongbalu dateCount = 3');
}

// 4m — summarizeByRegion empty input
{
  const summary = dl.summarizeByRegion([]);
  assertEq(Object.keys(summary).length, 0, 'empty → empty summary');
}

// 4n — summarizeByProvince DRC
{
  const summary = dl.summarizeByProvince(sampleCases, ugaMap);
  assert('Ituri' in summary, 'Ituri province present');
  assertEq(summary['Ituri'].totalConfirmed, 10, 'Ituri = Mongbalu 8 + Bunia 2');
  assertEq(summary['Ituri'].totalDeaths, 2, 'Ituri deaths = 2');
}

// 4o — summarizeByProvince Uganda
{
  const summary = dl.summarizeByProvince(sampleCases, ugaMap);
  assert('Kampala' in summary, 'Kampala present');
  assertEq(summary['Kampala'].totalConfirmed, 18, 'Kampala = 10+8');
}

// 4p — summarizeByProvince null ugaMap graceful
{
  const summary = dl.summarizeByProvince(sampleCases, null);
  assert('Ituri' in summary, 'DRC still present with null map');
  assert('Kampala' in summary, 'Uganda zone by region name');
}

// 4q — getTimeRange single date
{
  const single = dl.getTimeRange([{ date: '2026-05-14', region: 'X' }]);
  assertDeepEq(single, ['2026-05-14', '2026-05-14'], 'single date');
}

// 4r — stateKeysEqual (view render-skip gate — 5 views depend on this)
{
  // All keys same (including arrays) → true
  const a = { ts: [1, 2], sel: ['a', 'b'], n: 3 };
  const b = { ts: [1, 2], sel: ['a', 'b'], n: 3 };
  assert(dl.stateKeysEqual(a, b, ['ts', 'sel', 'n']) === true, 'all same → true');

  // Different array values → false
  const c = { ts: [1, 2], sel: ['a', 'c'], n: 3 };
  assert(dl.stateKeysEqual(a, c, ['ts', 'sel', 'n']) === false, 'different array value → false');

  // Different primitive → false
  assert(dl.stateKeysEqual(a, { ...a, n: 4 }, ['ts', 'sel', 'n']) === false, 'different primitive → false');

  // Array length mismatch → false
  assert(dl.stateKeysEqual(a, { ...a, sel: ['a'] }, ['ts', 'sel', 'n']) === false, 'array length mismatch → false');

  // Empty arrays equal → true
  assert(dl.stateKeysEqual({ sel: [] }, { sel: [] }, ['sel']) === true, 'empty arrays → true');

  // Same array reference (identity) → true (fast path)
  const arr = ['a', 'b'];
  assert(dl.stateKeysEqual({ sel: arr }, { sel: arr }, ['sel']) === true, 'same ref → true');

  // Null prev → false
  assert(dl.stateKeysEqual(null, { sel: [] }, ['sel']) === false, 'null prev → false');

  // Subset of keys compared (extra keys in objects ignored)
  assert(dl.stateKeysEqual({ sel: [], x: 1 }, { sel: [], x: 2 }, ['sel']) === true, 'extra keys ignored → true');

  // Different array order → false (element-by-element comparison)
  assert(dl.stateKeysEqual({ sel: ['a', 'b'] }, { sel: ['b', 'a'] }, ['sel']) === false, 'different order → false');
}

// ══════════════════════════════════════════════════════════════════════════════
// Report
// ══════════════════════════════════════════════════════════════════════════════
const total = passed + failed;
console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${passed}/${total} passed`);
if (failed > 0) {
  console.error(`  ${failed} FAILED`);
  process.exit(1);
}
console.log(`  ✅ All ${total} unit tests passed`);
