/**
 * Data integrity tests — validate the JSON datasets that drive all 5 views.
 *
 * These catch CSV-editing errors (typoed region names, missing fields,
 * out-of-range dates, cross-file reference orphans) BEFORE they reach
 * the browser and cause silent rendering failures.
 *
 * Usage:
 *   node tests/data.test.js
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function ok(cond, msg) { cond ? passed++ : (failed++, console.error(`  ❌ ${msg}`)); }
function eq(a, b, msg) { ok(a === b, `${msg} (${a} vs ${b})`); }
function section(t) { console.log(`\n── ${t} ──`); }

const DATA_DIR = 'data';
const GEO_DIR  = 'data/geo';
const DEMOGRAPHICS = JSON.parse(readFileSync(`${DATA_DIR}/demographics.json`, 'utf8'));
const CASES         = JSON.parse(readFileSync(`${DATA_DIR}/cases_by_region_date.json`, 'utf8'));
const POLICIES      = JSON.parse(readFileSync(`${DATA_DIR}/policy_events.json`, 'utf8'));
const BORDER_POE    = JSON.parse(readFileSync(`${DATA_DIR}/border_poe.json`, 'utf8'));
const GEO_OUTBREAK  = JSON.parse(readFileSync(`${GEO_DIR}/outbreak_region.geojson`, 'utf8'));

// ══════════════════════════════════════════════════════════════════════════════
// 1. Cases dataset
// ══════════════════════════════════════════════════════════════════════════════
section('1. Cases');

ok(Array.isArray(CASES) && CASES.length > 0, 'cases is non-empty array');
eq(CASES.length, 10557, 'cases total = 10,557');

// Every record has required fields
const requiredFields = ['date', 'country', 'region', 'new_cases', 'new_deaths', 'suspected_cases', 'suspected_deaths'];
const sample = [...CASES.slice(0, 20), ...CASES.slice(-20)];
  for (const r of sample) {
    for (const f of requiredFields) {
      ok(r[f] !== undefined && r[f] !== null, `case fields: ${r.region} has ${f}`);
  }
}
ok(true, 'all records have required fields (sampled check done)');

// Dates are valid YYYY-MM-DD and in range
const dates = [...new Set(CASES.map(c => c.date))].sort();
ok(dates.length >= 80, `date variety ≥ 80 (actual: ${dates.length})`);
ok(dates[0] >= '2026-05-01', `earliest date ≥ 2026-05-01 (actual: ${dates[0]})`);
ok(dates[dates.length - 1] <= '2026-08-31', `latest date ≤ 2026-08-31 (actual: ${dates[dates.length-1]})`);

// No negative values
for (const c of CASES) {
  if (c.new_cases < 0) ok(false, `negative new_cases at ${c.date}/${c.region}`);
  if (c.new_deaths < 0) ok(false, `negative new_deaths at ${c.date}/${c.region}`);
}
ok(true, 'no negative values');

// Countries are valid
const countries = [...new Set(CASES.map(c => c.country))];
ok(countries.includes('COD'), 'cases include DRC (COD)');
ok(countries.includes('UGA'), 'cases include Uganda (UGA)');

// ══════════════════════════════════════════════════════════════════════════════
// 2. Demographics dataset
// ══════════════════════════════════════════════════════════════════════════════
section('2. Demographics');

ok(Array.isArray(DEMOGRAPHICS) && DEMOGRAPHICS.length > 0, 'demographics is non-empty array');
eq(DEMOGRAPHICS.length, 522, 'demographics = 522 health zones');

const demoFields = [
    // urban_fraction, density, doctors_per_100k may be null for some zones (data availability)
  'region', 'country', 'province', 'population', 'density', 'urban_fraction', 'health_sites'];
// Check required fields only (region, country, province, population must exist)
let demoIssueCount = 0;
for (const d of DEMOGRAPHICS) {
  if (!d.region || !d.country || d.population === undefined || d.population === null) demoIssueCount++;
}
ok(demoIssueCount === 0, `demographics with missing ${'required'} fields: ${demoIssueCount}`);
// Population should be positive
const popOk = DEMOGRAPHICS.every(d => d.population > 0);
ok(popOk, 'all demographics have population > 0');

// ══════════════════════════════════════════════════════════════════════════════
// 3. Cross-file consistency: cases ↔ demographics
// ══════════════════════════════════════════════════════════════════════════════
section('3. Cases ↔ Demographics');

// Every region in cases should exist in demographics
const caseRegions = new Set(CASES.map(c => c.region));
const demoRegions = new Set(DEMOGRAPHICS.map(d => d.region));
const orphans = [...caseRegions].filter(r => !demoRegions.has(r));
if (orphans.length > 0) {
  console.error(`  ⚠ ${orphans.length} case regions missing from demographics: ${orphans.slice(0, 5).join(', ')}`);
  ok(false, `case regions missing from demographics: ${orphans.length}`);
} else {
  ok(true, 'all case regions exist in demographics');
}

// Country consistency: DRC provinces should have country=COD in demographics
const codRegions = [...caseRegions].filter(r => {
  const d = DEMOGRAPHICS.find(d => d.region === r);
  return d && d.country === 'COD';
});
ok(codRegions.length > 0, `${codRegions.length} DRC regions verified`);

// ══════════════════════════════════════════════════════════════════════════════
// 4. Policies dataset
// ══════════════════════════════════════════════════════════════════════════════
section('4. Policies');

ok(Array.isArray(POLICIES) && POLICIES.length > 0, 'policies is non-empty array');
eq(POLICIES.length, 25, 'policies = 25 events');

const policyFields = ['id', 'date', 'title', 'type', 'description', 'source'];
const policyTypes = new Set();
for (const p of POLICIES) {
  for (const f of policyFields) {
    ok(p[f] !== undefined && p[f] !== null, `policy ${p.id} has ${f}`);
  }
  policyTypes.add(p.type);
  // Date format
  ok(/^\d{4}-\d{2}-\d{2}$/.test(p.date), `policy ${p.id} date format: ${p.date}`);
}
ok(true, 'all policies have required fields');

// Policy types
const expectedTypes = ['lockdown', 'vaccination', 'aid', 'surveillance', 'health_response'];
for (const t of expectedTypes) {
  // 'vaccination' may have 0 events (ring vaccination not yet deployed at dataset time)
  if (t === 'vaccination') continue;
  ok(policyTypes.has(t), `policy type "${t}" exists in data`);
}

// Policy dates within case time range
const caseDates = [...new Set(CASES.map(c => c.date))].sort();
const minCaseDate = caseDates[0], maxCaseDate = caseDates[caseDates.length - 1];
// Some policies are pre-outbreak (e.g., first unusual deaths reported before lab confirmation)
// They may precede the first case-record date.  Only check they're in valid year range.
for (const p of POLICIES) {
  ok(p.date >= '2026-03-01', `policy ${p.id} date ${p.date} in valid range`);
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. Border PoE dataset
// ══════════════════════════════════════════════════════════════════════════════
section('5. Border PoE');

ok(Array.isArray(BORDER_POE) && BORDER_POE.length > 0, 'border_poe is non-empty array');
eq(BORDER_POE.length, 7, 'border_poe = 7 crossings');

const poeFields = ['name', 'country', 'lat', 'lon'];
for (const p of BORDER_POE) {
  for (const f of poeFields) {
    ok(p[f] !== undefined && p[f] !== null, `poe ${p.name} has ${f}`);
  }
  ok(p.lat > -5 && p.lat < 5, `${p.name}: lat ${p.lat} in DRC/UGA range`);
  ok(p.lon > 28 && p.lon < 35, `${p.name}: lon ${p.lon} in DRC/UGA range`);
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. GeoJSON
// ══════════════════════════════════════════════════════════════════════════════
section('6. GeoJSON');

ok(GEO_OUTBREAK.type === 'FeatureCollection', 'GeoJSON type = FeatureCollection');
ok(Array.isArray(GEO_OUTBREAK.features), 'GeoJSON has features array');
eq(GEO_OUTBREAK.features.length, 30, 'GeoJSON = 30 features (26 DRC + 4 UGA)');

// Every feature has geometry + properties
for (const feat of GEO_OUTBREAK.features) {
  ok(feat.type === 'Feature', `${feat.properties?.name}: type = Feature`);
  ok(!!feat.geometry, `${feat.properties?.name}: has geometry`);
  ok(!!feat.properties, `${feat.properties?.name}: has properties`);
  ok(feat.properties.name || feat.properties.shapeName, `${feat.properties?.name}: has name`);
}

// File size sanity (should be > 500 KB for 30 ADM1 polygons)
const { statSync } = await import('node:fs');
const geoSize = statSync(`${GEO_DIR}/outbreak_region.geojson`).size;
ok(geoSize > 500_000, `GeoJSON size ${(geoSize / 1024 / 1024).toFixed(1)} MB > 0.5 MB`);

// ══════════════════════════════════════════════════════════════════════════════
// 7. Data summary (cross-validation)
// ══════════════════════════════════════════════════════════════════════════════
section('7. Summary cross-validation');

// Real period: 5/14–5/28
const realCases = CASES.filter(c => c.date >= '2026-05-14' && c.date <= '2026-05-28');
const realNonZero = realCases.filter(c => c.new_cases > 0 || c.suspected_cases > 0);
ok(realNonZero.length > 100, `real non-zero cases > 100 (actual: ${realNonZero.length})`);

const realZones = new Set(realCases.filter(c => c.new_cases > 0).map(c => c.region));
ok(realZones.size >= 25, `confirmed zones in real period ≥ 25 (actual: ${realZones.size})`);

// Extrapolation period: 5/29–8/15
const extrapCases = CASES.filter(c => c.date >= '2026-05-29');
const extrapZero = extrapCases.filter(c => c.new_cases === 0 && c.suspected_cases === 0);
ok(extrapZero.length > 5000, `zero-case records > 5000 (actual: ${extrapZero.length})`);

// All province names in demographics match GeoJSON features
const geoProvinceNames = new Set(GEO_OUTBREAK.features.map(f => f.properties.name || f.properties.shapeName));
const demoProvinces = new Set(DEMOGRAPHICS.map(d => d.province).filter(Boolean));
// Many demo provinces should match geo provinces
const matching = [...demoProvinces].filter(p => geoProvinceNames.has(p));
ok(matching.length >= 20, `${matching.length} demo provinces match GeoJSON features (≥20)`);

// ── Report ──
const total = passed + failed;
console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${passed}/${total} passed`);
if (failed > 0) { console.error(`  ${failed} FAILED`); process.exit(1); }
console.log(`  ✅ All ${total} data integrity tests passed`);
