/**
 * Data loader — fetches all JSON files and provides filter helpers.
 * Data sources (all CC BY 4.0):
 *   B.1 - WHO AFRO Weekly SitReps (via kraemer-lab/Ebola_DRC_2026)
 *   B.2 - WHO Disease Outbreak News (DON 605)
 *   B.3 - World Bank + HDX population/geographic data
 *   B.4 - WHO GHO health workforce statistics
 *   B.5 - ReliefWeb humanitarian/policy data
 */

const DATA_PATHS = {
  cases:               'data/cases_by_region_date.json',
  demographics:        'data/demographics.json',
  policies:            'data/policy_events.json',
  borderPoE:           'data/border_poe.json',
  geoOutbreak:         'data/geo/outbreak_region.geojson',  // Merged DRC+UGA ADM1
  ugaDistrictRegion:   'data/geo/uga_district_region_map.json',
};

/** Load all data files. Returns { cases, demographics, policies, borderPoE, geoDRC, geoUGA }. */
export async function loadAllData() {
  const results = {};
  const keys = Object.keys(DATA_PATHS);

  for (const key of keys) {
    try {
      const resp = await fetch(DATA_PATHS[key]);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      results[key] = await resp.json();
      console.log(`  ✓ loaded ${key}: ${Array.isArray(results[key]) ? results[key].length + ' items' : 'GeoJSON'}`);
    } catch (e) {
      console.warn(`  ⚠ ${key} not available: ${e.message}`);
      results[key] = null; // Graceful degradation
    }
  }

  return results;
}

/** Derive full time range from case data. */
export function getTimeRange(cases) {
  if (!cases || cases.length === 0) return ['2026-05-01', '2026-05-31'];
  const dates = [...new Set(cases.map(c => c.date))].sort();
  return [dates[0], dates[dates.length - 1]];
}

/** Get unique regions from case data. */
export function getAllRegions(cases) {
  if (!cases) return [];
  return [...new Set(cases.map(c => c.region))].sort();
}

/** Filter cases by store state. Returns filtered array. */
export function filterCases(cases, state) {
  if (!cases) return [];
  let filtered = cases;

  // Time filter
  if (state.timeRange && state.timeRange.length === 2) {
    filtered = filtered.filter(c => c.date >= state.timeRange[0] && c.date <= state.timeRange[1]);
  }

  // Animation date — show only that date
  if (state.animatingDate) {
    filtered = filtered.filter(c => c.date === state.animatingDate);
  }

  // Region filter (persistent selection)
  if (state.selectedRegions && state.selectedRegions.length > 0) {
    filtered = filtered.filter(c => state.selectedRegions.includes(c.region));
  }

  return filtered;
}

/** Aggregate cases by region. Returns { region: [{date, new_cases, ...}, ...] }. */
export function aggregateByRegion(cases) {
  const byRegion = {};
  for (const c of cases) {
    if (!byRegion[c.region]) byRegion[c.region] = [];
    byRegion[c.region].push({ ...c });
  }
  // Sort by date
  for (const region of Object.keys(byRegion)) {
    byRegion[region].sort((a, b) => a.date.localeCompare(b.date));
  }
  return byRegion;
}

/** Build a case-summary object per region. */
export function summarizeByRegion(cases) {
  const summary = {};
  for (const c of cases) {
    if (!summary[c.region]) {
      summary[c.region] = {
        region: c.region,
        country: c.country,
        province: c.province || '',
        totalConfirmed: 0,
        totalDeaths: 0,
        totalSuspected: 0,
        totalSuspectedDeaths: 0,
        dates: new Set(),
      };
    }
    const s = summary[c.region];
    s.totalConfirmed += c.new_cases || 0;
    s.totalDeaths += c.new_deaths || 0;
    s.totalSuspected += c.suspected_cases || 0;
    s.totalSuspectedDeaths += c.suspected_deaths || 0;
    s.dates.add(c.date);
  }
  // Convert Sets to counts
  for (const r of Object.keys(summary)) {
    summary[r].dateCount = summary[r].dates.size;
    delete summary[r].dates;
  }
  return summary;
}

/**
 * Aggregate cases to ADM1 province level for choropleth map encoding.
 *
 * DRC health zones already carry a `province` field.
 * Uganda zones use district names — we map them to ADM1 regions via
 * `ugaDistrictRegion` (loaded from data/geo/uga_district_region_map.json).
 *
 * Returns { provinceName: { totalConfirmed, totalDeaths, totalSuspected, country } }
 */
export function summarizeByProvince(cases, ugaDistrictRegion) {
  const summary = {};
  const map = ugaDistrictRegion || {};

  for (const c of cases) {
    // Resolve ADM1 name: DRC uses province field; Uganda districts → region map
    let adm1 = c.province || c.region;
    if (c.country === 'UGA' && map[c.region]) {
      adm1 = map[c.region];
    }

    if (!summary[adm1]) {
      summary[adm1] = {
        province: adm1,
        country: c.country,
        totalConfirmed: 0,
        totalDeaths: 0,
        totalSuspected: 0,
      };
    }
    const s = summary[adm1];
    s.totalConfirmed += c.new_cases || 0;
    s.totalDeaths += c.new_deaths || 0;
    s.totalSuspected += c.suspected_cases || 0;
  }
  return summary;
}
