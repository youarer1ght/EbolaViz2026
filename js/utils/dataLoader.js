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
  zoneCoords:          'data/zone_coords.json',             // Health zone centroids from INRB shapefile
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

/** Filter cases by store state. Returns filtered array.
 *  Memoized: same state params + same source array → same result.
 *  Each state change triggers 5+ views calling filterCases with the
 *  same parameters — memoization cuts this to 1 actual filter pass. */
let _cacheKey = '';
let _cacheResult = null;
let _cacheSourceLen = -1;

export function filterCases(cases, state) {
  if (!cases) return [];

  // Build a cache key from source identity + filtering-relevant state fields.
  // Include array length so different source arrays don't collide.
  const key = `${cases.length}|${state.animatingDate || ''}|${(state.timeRange || []).join(',')}|${(state.selectedRegions || []).sort().join(',')}`;
  if (key === _cacheKey && _cacheResult !== null) return _cacheResult;

  _cacheKey = key;
  let filtered = cases;

  // Animation date — precise single-date filter, overrides timeRange
  if (state.animatingDate) {
    filtered = filtered.filter(c => c.date === state.animatingDate);
  } else if (state.timeRange && state.timeRange.length === 2) {
    // Time range filter — only active when NOT animating
    filtered = filtered.filter(c => c.date >= state.timeRange[0] && c.date <= state.timeRange[1]);
  }

  // Region filter (persistent selection)
  if (state.selectedRegions && state.selectedRegions.length > 0) {
    filtered = filtered.filter(c => state.selectedRegions.includes(c.region));
  }

  _cacheResult = filtered;
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

/**
 * Shallow-compare named state keys.  Returns true iff all keys match
 * between prev and next.  Used by views to skip re-rendering on state
 * changes that don't affect them (e.g. SET_HIGHLIGHTED_REGIONS is ignored
 * by parallelView, policyView, and detailView).
 */
export function stateKeysEqual(prev, next, keys) {
  if (!prev) return false;
  for (const k of keys) {
    const pv = prev[k], nv = next[k];
    if (pv === nv) continue;
    // Fast array diff (selectedRegions, timeRange, selectedPolicyIds)
    if (Array.isArray(pv) && Array.isArray(nv)) {
      if (pv.length !== nv.length) return false;
      for (let i = 0; i < pv.length; i++) {
        if (pv[i] !== nv[i]) return false;
      }
      continue;
    }
    return false;
  }
  return true;
}
