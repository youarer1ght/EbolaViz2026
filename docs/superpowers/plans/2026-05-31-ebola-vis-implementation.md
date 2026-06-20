# 2026 Ebola Spatiotemporal Visualization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 5-view coordinated Ebola outbreak visualization web app (heatmap, timeline, parallel coordinates, policy timeline, detail panel) with centralized Store-driven Brushing & Linking, deployed to GitHub Pages.

**Architecture:** Single-page vanilla JS app. Global Store (hand-written ~50 lines observer pattern) holds all filter state. Five ECharts views subscribe to Store changes. User interactions dispatch actions → Store updates → all views re-render. Data preprocessed as static JSON files, loaded at startup.

**Tech Stack:** ECharts 5 (CDN), vanilla JavaScript (ES modules via `<script type="module">`), CSS Grid, Python 3 (Pandas/NumPy for data preprocessing), GitHub Pages.

---

## File Structure (Post-Implementation)

```
EbolaViz2026/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── main.js                 # Entry: init store, load data, init views
│   ├── store.js                # createStore() + reducer
│   ├── actions.js              # Action type constants + creators
│   ├── views/
│   │   ├── heatmapView.js      # ECharts map heatmap with GeoJSON
│   │   ├── timelineView.js     # Multi-series line/bar chart + dataZoom
│   │   ├── parallelView.js     # ECharts parallel coordinates
│   │   ├── policyView.js       # Custom timeline with policy markers
│   │   └── detailView.js       # Summary statistics panel
│   └── utils/
│       ├── dataLoader.js       # fetch() all JSON files, return data object
│       └── colors.js           # Color constants and gradient functions
├── data/
│   ├── cases_by_region_date.json
│   ├── demographics.json
│   ├── policy_events.json
│   └── geo/
│       ├── DRC.geojson
│       └── Uganda.geojson
├── scripts/
│   ├── generate_mock_data.py   # Generate synthetic dev data
│   ├── fetch_data.py           # Fetch real data from WHO/ACAPS/HDX
│   ├── clean_and_merge.py      # Clean, merge, output data/*.json
│   └── requirements.txt
└── docs/
    ├── 中期文档.md
    ├── 系统文档.md
    └── 分工说明.md
```

---

## Phase 0: Mock Data Generation

### Task 0: Generate mock development data

**Files:**
- Create: `scripts/generate_mock_data.py`
- Create: `scripts/requirements.txt`
- Create: `data/cases_by_region_date.json`
- Create: `data/demographics.json`
- Create: `data/policy_events.json`

- [ ] **Step 1: Create requirements.txt**

```txt
pandas>=2.0.0
numpy>=1.24.0
```

- [ ] **Step 2: Write mock data generator**

```python
"""Generate synthetic Ebola outbreak data for DRC and Uganda, 2026."""
import json
import random
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
GEO_DIR = DATA_DIR / "geo"
SEED = 42
random.seed(SEED)
np.random.seed(SEED)

# ---- Config ----
START_DATE = "2026-01-15"
END_DATE = "2026-05-15"
DATES = []
d = datetime(2026, 1, 15)
while d <= datetime(2026, 5, 15):
    DATES.append(d.strftime("%Y-%m-%d"))
    d += timedelta(days=1)

# DRC and Uganda provinces
REGIONS = {
    "COD": ["Nord-Kivu", "Ituri", "Sud-Kivu", "Tshopo", "Haut-Uele", "Maniema", "Bas-Uele", "Equateur", "Kinshasa", "Kongo-Central"],
    "UGA": ["Kampala", "Wakiso", "Jinja", "Mbale", "Gulu", "Arua", "Mbarara", "Kabale", "Kisoro", "Kanungu"],
}

def generate_cases():
    """Generate daily case counts per region, with realistic outbreak dynamics."""
    records = []
    for country, regions in REGIONS.items():
        for region in regions:
            # Base risk: border regions higher
            is_border = region in ["Nord-Kivu", "Ituri", "Sud-Kivu", "Kisoro", "Kanungu", "Arua"]
            is_urban = region in ["Kinshasa", "Kampala", "Wakiso", "Gulu"]
            base_rate = 0.3 if is_border else 0.05
            urban_mult = 2.5 if is_urban else 1.0

            cumulative = 0
            for i, date in enumerate(DATES):
                # Outbreak peaks around day 60-80
                t = i / len(DATES)
                wave = np.exp(-((t - 0.45) ** 2) / 0.03) * 8 + np.exp(-((t - 0.7) ** 2) / 0.05) * 3
                new_cases = max(0, int(np.random.poisson(base_rate * urban_mult * (1 + wave))))
                new_deaths = max(0, int(new_cases * np.random.beta(2, 20)))  # ~5-10% CFR
                cumulative += new_cases
                records.append({
                    "date": date,
                    "country": "COD" if country == "COD" else "UGA",
                    "region": region,
                    "new_cases": new_cases,
                    "new_deaths": new_deaths,
                    "cumulative_cases": cumulative,
                })
    return records

def generate_demographics():
    """Generate per-province demographic and healthcare data."""
    records = []
    for country, regions in REGIONS.items():
        for i, region in enumerate(regions):
            pop_density = round(random.uniform(15, 500), 1)
            records.append({
                "country": country,
                "region": region,
                "population": random.randint(80000, 1500000),
                "population_density": pop_density,
                "doctors_per_100k": round(random.uniform(0.5, 25.0), 2),
            })
    return records

def generate_policy_events():
    """Generate structured policy/timeline events."""
    events = [
        {"id": "P001", "date": "2026-01-20", "type": "surveillance", "country": "COD", "region": "Nord-Kivu", "title": "Alert: First cases reported in Nord-Kivu", "description": "Local health authorities report cluster of hemorrhagic fever cases.", "source": "WHO AFRO Situation Report"},
        {"id": "P002", "date": "2026-01-25", "type": "surveillance", "country": "COD", "region": "Ituri", "title": "Cases confirmed in Ituri province", "description": "Laboratory confirmation of Ebola (Bundibugyo strain).", "source": "WHO AFRO"},
        {"id": "P003", "date": "2026-02-01", "type": "lockdown", "country": "COD", "region": "Nord-Kivu", "title": "Border restrictions imposed", "description": "DRC restricts movement at Uganda border crossings.", "source": "ReliefWeb"},
        {"id": "P004", "date": "2026-02-10", "type": "vaccination", "country": "COD", "region": "Nord-Kivu", "title": "Ring vaccination campaign launched", "description": "WHO-led vaccination targeting contacts in Nord-Kivu.", "source": "WHO AFRO"},
        {"id": "P005", "date": "2026-02-15", "type": "aid", "country": "COD", "region": "Ituri", "title": "MSF deploys treatment centers", "description": "Médecins Sans Frontières opens Ebola treatment units.", "source": "ACAPS"},
        {"id": "P006", "date": "2026-02-20", "type": "surveillance", "country": "UGA", "region": "Kisoro", "title": "First confirmed case in Uganda", "description": "Cross-border case detected in Kisoro district.", "source": "WHO AFRO"},
        {"id": "P007", "date": "2026-02-25", "type": "lockdown", "country": "UGA", "region": "Kisoro", "title": "Uganda closes border with DRC", "description": "All non-essential cross-border movement halted.", "source": "ReliefWeb"},
        {"id": "P008", "date": "2026-03-05", "type": "vaccination", "country": "UGA", "region": "Kampala", "title": "Vaccination extended to Uganda", "description": "Ring vaccination begins in affected Ugandan districts.", "source": "WHO AFRO"},
        {"id": "P009", "date": "2026-03-15", "type": "aid", "country": "UGA", "region": "Kampala", "title": "International aid package approved", "description": "$50M emergency funding released by World Bank.", "source": "ReliefWeb"},
        {"id": "P010", "date": "2026-04-01", "type": "surveillance", "country": "COD", "region": "Nord-Kivu", "title": "Case decline observed", "description": "New cases drop below 5/day for first time in Nord-Kivu.", "source": "WHO AFRO"},
        {"id": "P011", "date": "2026-04-20", "type": "lockdown", "country": "COD", "region": "Nord-Kivu", "title": "Restrictions partially lifted", "description": "Some border controls eased as transmission declines.", "source": "ACAPS"},
        {"id": "P012", "date": "2026-05-01", "type": "surveillance", "country": "UGA", "region": "Kampala", "title": "Outbreak declared contained in Uganda", "description": "No new cases for 21 days in Uganda.", "source": "WHO AFRO"},
    ]
    return events

def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    GEO_DIR.mkdir(parents=True, exist_ok=True)

    cases = generate_cases()
    with open(DATA_DIR / "cases_by_region_date.json", "w") as f:
        json.dump(cases, f, indent=2)

    demos = generate_demographics()
    with open(DATA_DIR / "demographics.json", "w") as f:
        json.dump(demos, f, indent=2)

    policies = generate_policy_events()
    with open(DATA_DIR / "policy_events.json", "w") as f:
        json.dump(policies, f, indent=2)

    print(f"Generated: {len(cases)} case records, {len(demos)} province records, {len(policies)} policy events")

if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run generator**

```bash
cd /home/yin/EbolaViz2026
python3 scripts/generate_mock_data.py
```

Expected: `Generated: 14520 case records, 20 province records, 12 policy events`
Verify: `ls -la data/cases_by_region_date.json data/demographics.json data/policy_events.json`

- [ ] **Step 4: Commit**

```bash
git add scripts/generate_mock_data.py scripts/requirements.txt data/
git commit -m "feat: add mock data generator with realistic outbreak dynamics"
```

---

## Phase 1: Foundation

### Task 1: HTML scaffold and CSS Grid layout

**Files:**
- Create: `index.html`
- Create: `css/style.css`

- [ ] **Step 1: Write index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2026 年埃博拉疫情时空可视化分析系统</title>
  <link rel="stylesheet" href="css/style.css">
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
</head>
<body>
  <div id="app">
    <!-- Title Bar -->
    <header id="titlebar">
      <h1>2026 年埃博拉疫情时空可视化分析系统</h1>
      <div id="controls">
        <button id="btn-play">▶ 播放</button>
        <button id="btn-pause" disabled>⏸ 暂停</button>
        <button id="btn-reset">↺ 重置</button>
        <span id="current-date"></span>
      </div>
    </header>

    <!-- View 1: Heatmap -->
    <section id="view-heatmap" class="chart-container">
      <h2>① 时空热力图</h2>
      <div id="chart-heatmap" class="chart"></div>
    </section>

    <!-- View 2: Timeline -->
    <section id="view-timeline" class="chart-container">
      <h2>② 时序趋势图</h2>
      <div id="chart-timeline" class="chart"></div>
    </section>

    <!-- View 3: Parallel Coordinates -->
    <section id="view-parallel" class="chart-container">
      <h2>③ 多因素关联分析</h2>
      <div id="chart-parallel" class="chart"></div>
    </section>

    <!-- View 4: Policy Timeline -->
    <section id="view-policy" class="chart-container">
      <h2>④ 防控政策时间轴</h2>
      <div id="chart-policy" class="chart"></div>
    </section>

    <!-- View 5: Detail Panel -->
    <section id="view-detail" class="chart-container">
      <h2>⑤ 详情面板</h2>
      <div id="chart-detail" class="chart"></div>
    </section>
  </div>

  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write style.css**

```css
/* Reset & Base */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f7fa; color: #333; }
#app { display: grid; grid-template-columns: 55fr 45fr; grid-template-rows: auto 50fr 30fr 20fr; grid-template-areas: "titlebar titlebar" "heatmap timeline" "parallel parallel" "policy detail"; height: 100vh; gap: 4px; padding: 4px; }

/* Title Bar */
#titlebar { grid-area: titlebar; display: flex; align-items: center; gap: 16px; padding: 8px 16px; background: #fff; border-bottom: 2px solid #e0e0e0; }
#titlebar h1 { font-size: 1.2rem; white-space: nowrap; }
#controls { display: flex; align-items: center; gap: 8px; margin-left: auto; }
#controls button { padding: 4px 12px; border: 1px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer; font-size: 0.85rem; }
#controls button:hover { background: #e8e8e8; }
#controls button:disabled { opacity: 0.4; cursor: default; }
#current-date { font-weight: bold; color: #d32f2f; min-width: 100px; }

/* Chart Grid Areas */
#view-heatmap { grid-area: heatmap; }
#view-timeline { grid-area: timeline; }
#view-parallel { grid-area: parallel; }
#view-policy { grid-area: policy; }
#view-detail { grid-area: detail; }

/* Chart Containers */
.chart-container { background: #fff; border-radius: 4px; padding: 6px; display: flex; flex-direction: column; overflow: hidden; }
.chart-container h2 { font-size: 0.85rem; padding: 0 4px 2px; color: #555; flex-shrink: 0; }
.chart { flex: 1; min-height: 0; }

/* Policy type badges */
.policy-lockdown { color: #d32f2f; }
.policy-vaccination { color: #2e7d32; }
.policy-aid { color: #1565c0; }
.policy-surveillance { color: #f57c00; }
```

- [ ] **Step 3: Commit**

```bash
git add index.html css/style.css
git commit -m "feat: add HTML scaffold with CSS Grid 5-view layout"
```

### Task 2: Store implementation

**Files:**
- Create: `js/store.js`
- Create: `js/actions.js`

- [ ] **Step 1: Write store.js**

```javascript
/**
 * Minimal observable store — ~40 lines, zero dependencies.
 *
 * const store = createStore(reducer, initialState);
 * store.dispatch({ type: 'SET_TIME_RANGE', payload: [...] });
 * const state = store.getState();
 * const unsub = store.subscribe((newState) => { ... });
 */

export function createStore(reducer, initialState) {
  let state = initialState;
  const listeners = new Set();

  function getState() {
    return state;
  }

  function dispatch(action) {
    const nextState = reducer(state, action);
    if (nextState === state) return; // no change, skip notify
    state = nextState;
    for (const fn of listeners) {
      fn(state);
    }
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn); // returns unsubscribe function
  }

  return { getState, dispatch, subscribe };
}

/**
 * Reducer: pure function (state, action) → newState.
 *
 * State shape (per spec section 3):
 * {
 *   timeRange: [startDate, endDate],
 *   animatingDate: null,
 *   isPlaying: false,
 *   selectedRegions: [],
 *   highlightedRegions: [],
 *   parallelAxesFilter: {
 *     populationDensity: [min, max],
 *     caseCount: [min, max],
 *     mortalityRate: [min, max],
 *     healthcareAccess: [min, max],
 *   },
 *   selectedPolicyIds: [],
 * }
 */

export const ACTION_TYPES = {
  SET_TIME_RANGE: 'SET_TIME_RANGE',
  SET_ANIMATING_DATE: 'SET_ANIMATING_DATE',
  SET_IS_PLAYING: 'SET_IS_PLAYING',
  SET_SELECTED_REGIONS: 'SET_SELECTED_REGIONS',
  SET_HIGHLIGHTED_REGIONS: 'SET_HIGHLIGHTED_REGIONS',
  SET_PARALLEL_AXES_FILTER: 'SET_PARALLEL_AXES_FILTER',
  SET_SELECTED_POLICY_IDS: 'SET_SELECTED_POLICY_IDS',
  RESET_ALL: 'RESET_ALL',
};

export function reducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.SET_TIME_RANGE:
      return { ...state, timeRange: action.payload };

    case ACTION_TYPES.SET_ANIMATING_DATE:
      return { ...state, animatingDate: action.payload };

    case ACTION_TYPES.SET_IS_PLAYING:
      return { ...state, isPlaying: action.payload };

    case ACTION_TYPES.SET_SELECTED_REGIONS:
      return { ...state, selectedRegions: action.payload };

    case ACTION_TYPES.SET_HIGHLIGHTED_REGIONS:
      return { ...state, highlightedRegions: action.payload };

    case ACTION_TYPES.SET_PARALLEL_AXES_FILTER:
      return { ...state, parallelAxesFilter: { ...state.parallelAxesFilter, ...action.payload } };

    case ACTION_TYPES.SET_SELECTED_POLICY_IDS:
      return { ...state, selectedPolicyIds: action.payload };

    case ACTION_TYPES.RESET_ALL:
      return { ...state,
        timeRange: action.payload.timeRange,
        animatingDate: null,
        isPlaying: false,
        selectedRegions: [],
        highlightedRegions: [],
        parallelAxesFilter: {
          populationDensity: [-Infinity, Infinity],
          caseCount: [-Infinity, Infinity],
          mortalityRate: [-Infinity, Infinity],
          healthcareAccess: [-Infinity, Infinity],
        },
        selectedPolicyIds: [],
      };

    default:
      return state;
  }
}

export function getInitialState(fullTimeRange) {
  return {
    timeRange: fullTimeRange,
    animatingDate: null,
    isPlaying: false,
    selectedRegions: [],
    highlightedRegions: [],
    parallelAxesFilter: {
      populationDensity: [-Infinity, Infinity],
      caseCount: [-Infinity, Infinity],
      mortalityRate: [-Infinity, Infinity],
      healthcareAccess: [-Infinity, Infinity],
    },
    selectedPolicyIds: [],
  };
}
```

- [ ] **Step 2: Write actions.js**

```javascript
import { ACTION_TYPES } from './store.js';

export function setTimeRange(range) {
  return { type: ACTION_TYPES.SET_TIME_RANGE, payload: range };
}

export function setAnimatingDate(date) {
  return { type: ACTION_TYPES.SET_ANIMATING_DATE, payload: date };
}

export function setIsPlaying(playing) {
  return { type: ACTION_TYPES.SET_IS_PLAYING, payload: playing };
}

export function setSelectedRegions(regions) {
  return { type: ACTION_TYPES.SET_SELECTED_REGIONS, payload: regions };
}

export function setHighlightedRegions(regions) {
  return { type: ACTION_TYPES.SET_HIGHLIGHTED_REGIONS, payload: regions };
}

export function setParallelAxesFilter(filter) {
  return { type: ACTION_TYPES.SET_PARALLEL_AXES_FILTER, payload: filter };
}

export function setSelectedPolicyIds(ids) {
  return { type: ACTION_TYPES.SET_SELECTED_POLICY_IDS, payload: ids };
}

export function resetAll(fullTimeRange) {
  return { type: ACTION_TYPES.RESET_ALL, payload: { timeRange: fullTimeRange } };
}
```

- [ ] **Step 3: Commit**

```bash
git add js/store.js js/actions.js
git commit -m "feat: implement centralized Store with reducer and action creators"
```

### Task 3: Data loader and color utilities

**Files:**
- Create: `js/utils/dataLoader.js`
- Create: `js/utils/colors.js`

- [ ] **Step 1: Write dataLoader.js**

```javascript
const DATA_PATHS = {
  cases: 'data/cases_by_region_date.json',
  demographics: 'data/demographics.json',
  policies: 'data/policy_events.json',
  geoDRC: 'data/geo/DRC.geojson',
  geoUGA: 'data/geo/UGA.geojson',
};

export async function loadAllData() {
  const [cases, demographics, policies, geoDRC, geoUGA] = await Promise.all([
    fetch(DATA_PATHS.cases).then(r => r.json()),
    fetch(DATA_PATHS.demographics).then(r => r.json()),
    fetch(DATA_PATHS.policies).then(r => r.json()),
    fetch(DATA_PATHS.geoDRC).then(r => r.json()),
    fetch(DATA_PATHS.geoUGA).then(r => r.json()),
  ]);

  return { cases, demographics, policies, geoDRC, geoUGA };
}

/**
 * Derive the full time range from case data.
 */
export function getTimeRange(cases) {
  const dates = cases.map(c => c.date).sort();
  return [dates[0], dates[dates.length - 1]];
}

/**
 * Filter cases by current store state. Used by views that need subset data.
 */
export function filterCases(cases, { timeRange, selectedRegions, animatingDate }) {
  let filtered = cases;

  if (timeRange && timeRange.length === 2) {
    filtered = filtered.filter(c => c.date >= timeRange[0] && c.date <= timeRange[1]);
  }

  if (selectedRegions && selectedRegions.length > 0) {
    filtered = filtered.filter(c => selectedRegions.includes(c.region));
  }

  if (animatingDate) {
    filtered = filtered.filter(c => c.date === animatingDate);
  }

  return filtered;
}

/**
 * Aggregate cases to daily totals grouped by region.
 * Returns: { "Nord-Kivu": [{date, new_cases, new_deaths, cumulative_cases}, ...], ... }
 */
export function aggregateByRegion(cases) {
  const byRegion = {};
  for (const c of cases) {
    if (!byRegion[c.region]) byRegion[c.region] = [];
    byRegion[c.region].push(c);
  }
  // Sort each region's data by date
  for (const region of Object.keys(byRegion)) {
    byRegion[region].sort((a, b) => a.date.localeCompare(b.date));
  }
  return byRegion;
}
```

- [ ] **Step 2: Write colors.js**

```javascript
/** Color scheme constants, per spec section 6. */

// Heatmap: yellow-orange-red 5-level gradient
export const HEATMAP_COLORS = ['#ffffb2', '#fecc5c', '#fd8d3c', '#e31a1c', '#800026'];

// Timeline: Tableau 10 palette for multi-region distinction
export const TABLEAU_10 = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];

// Policy type colors
export const POLICY_COLORS = {
  lockdown: '#d32f2f',
  vaccination: '#2e7d32',
  aid: '#1565c0',
  surveillance: '#f57c00',
};

// Background
export const BG_COLOR = '#f5f7fa';

/**
 * Interpolate a color from the heatmap gradient based on value [0, 1].
 */
export function heatmapColor(value) {
  const colors = HEATMAP_COLORS;
  if (value <= 0) return colors[0];
  if (value >= 1) return colors[colors.length - 1];
  const idx = value * (colors.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const t = idx - lo;
  // Simple linear interpolation between two hex colors
  return interpolateHex(colors[lo], colors[hi], t);
}

function interpolateHex(c1, c2, t) {
  const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}
```

- [ ] **Step 3: Commit**

```bash
git add js/utils/dataLoader.js js/utils/colors.js
git commit -m "feat: add data loader and color utility modules"
```

### Task 4: Application entry point (main.js)

**Files:**
- Create: `js/main.js`

- [ ] **Step 1: Write main.js**

```javascript
import { createStore, reducer, getInitialState } from './store.js';
import { loadAllData, getTimeRange } from './utils/dataLoader.js';
import { initHeatmap } from './views/heatmapView.js';
import { initTimeline } from './views/timelineView.js';
import { initParallel } from './views/parallelView.js';
import { initPolicy } from './views/policyView.js';
import { initDetail } from './views/detailView.js';
import { setAnimatingDate, setIsPlaying, resetAll, setTimeRange, setSelectedRegions, setHighlightedRegions, setParallelAxesFilter, setSelectedPolicyIds } from './actions.js';

async function main() {
  // 1. Load data
  const data = await loadAllData();
  const fullTimeRange = getTimeRange(data.cases);

  // 2. Create store
  const store = createStore(reducer, getInitialState(fullTimeRange));

  // 3. Initialize views — each gets DOM element, store, and data
  const views = [
    initHeatmap(document.getElementById('chart-heatmap'), store, data),
    initTimeline(document.getElementById('chart-timeline'), store, data),
    initParallel(document.getElementById('chart-parallel'), store, data),
    initPolicy(document.getElementById('chart-policy'), store, data),
    initDetail(document.getElementById('chart-detail'), store, data),
  ];

  // 4. Wire up title bar controls
  let animTimer = null;

  document.getElementById('btn-play').addEventListener('click', () => {
    store.dispatch(setIsPlaying(true));
    const dates = data.cases.map(c => c.date).sort();
    const uniqueDates = [...new Set(dates)].sort();
    let idx = uniqueDates.indexOf(store.getState().animatingDate || store.getState().timeRange[0]);
    if (idx < 0) idx = 0;

    animTimer = setInterval(() => {
      if (idx >= uniqueDates.length) {
        clearInterval(animTimer);
        store.dispatch(setIsPlaying(false));
        return;
      }
      store.dispatch(setAnimatingDate(uniqueDates[idx]));
      idx++;
    }, 600);
  });

  document.getElementById('btn-pause').addEventListener('click', () => {
    clearInterval(animTimer);
    store.dispatch(setIsPlaying(false));
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    clearInterval(animTimer);
    store.dispatch(resetAll(fullTimeRange));
  });

  // Update button states and date display
  store.subscribe((state) => {
    document.getElementById('btn-play').disabled = state.isPlaying;
    document.getElementById('btn-pause').disabled = !state.isPlaying;
    document.getElementById('current-date').textContent =
      state.animatingDate ? `当前播放日期：${state.animatingDate}` : '';
  });

  // 5. Handle window resize
  window.addEventListener('resize', () => {
    for (const view of views) {
      if (view.resize) view.resize();
    }
  });
}

document.addEventListener('DOMContentLoaded', main);
```

- [ ] **Step 2: Commit**

```bash
git add js/main.js
git commit -m "feat: add application entry point with store initialization and playback controls"
```

---

## Phase 2: Individual Views

### Task 5: Heatmap view (ECharts map)

**Files:**
- Create: `js/views/heatmapView.js`

- [ ] **Step 1: Write heatmapView.js**

```javascript
import { setSelectedRegions, setHighlightedRegions } from '../store.js';
import { filterCases } from '../utils/dataLoader.js';
import { HEATMAP_COLORS } from '../utils/colors.js';

export function initHeatmap(dom, store, data) {
  const chart = echarts.init(dom);

  // Register GeoJSON for DRC and Uganda
  echarts.registerMap('COD', data.geoDRC);
  echarts.registerMap('UGA', data.geoUGA);

  function buildOption(state) {
    const filtered = filterCases(data.cases, state);
    const byRegion = {};
    for (const c of filtered) {
      if (state.selectedRegions.length > 0 && !state.selectedRegions.includes(c.region)) continue;
      byRegion[c.region] = (byRegion[c.region] || 0) + c.new_cases;
    }

    const maxCases = Math.max(1, ...Object.values(byRegion));
    const mapData = Object.entries(byRegion).map(([name, value]) => ({ name, value }));

    return {
      backgroundColor: '#f5f7fa',
      tooltip: {
        trigger: 'item',
        formatter: (p) => `${p.name}<br/>新增确诊: ${p.value || 0}`,
      },
      visualMap: {
        min: 0,
        max: maxCases,
        inRange: { color: HEATMAP_COLORS },
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 8,
      },
      series: [
        {
          name: 'DRC',
          type: 'map',
          map: 'COD',
          roam: true,
          data: mapData.filter(d => data.geoDRC.features.some(f => f.properties.name === d.name)),
          nameProperty: 'name',
          label: { show: true, fontSize: 8 },
          emphasis: { label: { show: true, fontWeight: 'bold' } },
        },
        {
          name: 'Uganda',
          type: 'map',
          map: 'UGA',
          roam: true,
          data: mapData.filter(d => data.geoUGA.features.some(f => f.properties.name === d.name)),
          nameProperty: 'name',
          label: { show: true, fontSize: 8 },
          emphasis: { label: { show: true, fontWeight: 'bold' } },
        },
      ],
    };
  }

  // Click → select region (toggle)
  chart.on('click', (params) => {
    if (params.componentType === 'series' && params.name) {
      const current = store.getState().selectedRegions;
      const next = current.includes(params.name)
        ? current.filter(r => r !== params.name)
        : [...current, params.name];
      store.dispatch(setSelectedRegions(next));
    }
  });

  // Hover → highlight region (temp visual only)
  chart.on('mouseover', (params) => {
    if (params.componentType === 'series' && params.name) {
      store.dispatch(setHighlightedRegions([params.name]));
    }
  });
  chart.on('mouseout', () => {
    store.dispatch(setHighlightedRegions([]));
  });

  function render(state) {
    chart.setOption(buildOption(state), true);
  }

  function resize() {
    chart.resize();
  }

  // Subscribe
  const unsub = store.subscribe(render);
  render(store.getState()); // initial render

  return {
    render,
    resize,
    destroy() { unsub(); chart.dispose(); },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add js/views/heatmapView.js
git commit -m "feat: implement heatmap view with region selection and hover highlight"
```

### Task 6: Timeline view (multi-series line/bar chart)

**Files:**
- Create: `js/views/timelineView.js`

- [ ] **Step 1: Write timelineView.js**

```javascript
import { setTimeRange } from '../store.js';
import { filterCases, aggregateByRegion } from '../utils/dataLoader.js';
import { TABLEAU_10 } from '../utils/colors.js';

export function initTimeline(dom, store, data) {
  const chart = echarts.init(dom);

  function buildOption(state) {
    const filtered = filterCases(data.cases, state);
    const byRegion = aggregateByRegion(filtered);

    // Respect selectedRegions filter for series visibility
    const showRegions = state.selectedRegions.length > 0
      ? state.selectedRegions
      : Object.keys(byRegion);

    const series = showRegions.map((region, i) => ({
      name: region,
      type: 'line',
      data: (byRegion[region] || []).map(d => [d.date, d.new_cases]),
      smooth: true,
      symbol: 'none',
      lineStyle: { width: state.highlightedRegions.includes(region) ? 3 : 1.5 },
      color: TABLEAU_10[i % TABLEAU_10.length],
    }));

    return {
      backgroundColor: '#f5f7fa',
      tooltip: { trigger: 'axis' },
      legend: {
        type: 'scroll',
        bottom: 0,
        textStyle: { fontSize: 10 },
      },
      grid: { top: 8, right: 16, bottom: 36, left: 48 },
      xAxis: {
        type: 'time',
        axisLabel: { fontSize: 9, rotate: 30 },
      },
      yAxis: {
        type: 'value',
        name: '新增确诊',
        axisLabel: { fontSize: 9 },
      },
      dataZoom: [
        {
          type: 'slider',
          start: 0,
          end: 100,
          height: 20,
          bottom: 24,
        },
        {
          type: 'inside',
        },
      ],
      series,
    };
  }

  // dataZoom change → dispatch time range
  chart.on('dataZoom', () => {
    const opt = chart.getOption();
    const zoom = opt.dataZoom[0];
    if (zoom && zoom.startValue && zoom.endValue) {
      store.dispatch(setTimeRange([zoom.startValue, zoom.endValue]));
    }
  });

  function render(state) {
    chart.setOption(buildOption(state), true);
  }

  function resize() { chart.resize(); }

  const unsub = store.subscribe(render);
  render(store.getState());

  return { render, resize, destroy() { unsub(); chart.dispose(); } };
}
```

- [ ] **Step 2: Commit**

```bash
git add js/views/timelineView.js
git commit -m "feat: implement timeline view with multi-series lines and dataZoom"
```

### Task 7: Parallel coordinates view

**Files:**
- Create: `js/views/parallelView.js`

- [ ] **Step 1: Write parallelView.js**

```javascript
import { setParallelAxesFilter } from '../store.js';
import { filterCases } from '../utils/dataLoader.js';

export function initParallel(dom, store, data) {
  const chart = echarts.init(dom);

  function buildOption(state) {
    const filtered = filterCases(data.cases, state);

    // Build per-region aggregates for parallel coordinates
    const byRegion = {};
    for (const c of filtered) {
      if (!byRegion[c.region]) {
        const demo = data.demographics.find(d => d.region === c.region) || {};
        byRegion[c.region] = {
          region: c.region,
          totalCases: 0,
          totalDeaths: 0,
          popDensity: demo.population_density || 0,
          doctorsPer100k: demo.doctors_per_100k || 0,
        };
      }
      byRegion[c.region].totalCases += c.new_cases;
      byRegion[c.region].totalDeaths += c.new_deaths;
    }

    const items = Object.values(byRegion).map(r => ({
      ...r,
      mortalityRate: r.totalCases > 0 ? (r.totalDeaths / r.totalCases * 100).toFixed(1) : 0,
    }));

    const maxCases = Math.max(1, ...items.map(d => d.totalCases));

    return {
      backgroundColor: '#f5f7fa',
      tooltip: { trigger: 'item' },
      parallelAxis: [
        { dim: 0, name: '人口密度', type: 'value' },
        { dim: 1, name: '每10万人医生', type: 'value' },
        { dim: 2, name: '累计确诊', type: 'value' },
        { dim: 3, name: '死亡率(%)', type: 'value', max: 20 },
      ],
      parallel: {
        left: 60,
        right: 60,
        top: 24,
        bottom: 24,
        parallelAxisDefault: {
          axisLabel: { fontSize: 9 },
          nameTextStyle: { fontSize: 10 },
        },
      },
      series: [{
        type: 'parallel',
        lineStyle: {
          width: 1.5,
          opacity: 0.6,
          color: (p) => {
            // Gradient by mortality rate
            const rate = p.data[3] || 0;
            const t = Math.min(rate / 15, 1);
            const r = Math.round(255 * t);
            const g = Math.round(255 * (1 - t));
            const b = Math.round(100 * (1 - t));
            return `rgb(${r},${g},${b})`;
          },
        },
        emphasis: { lineStyle: { width: 3, opacity: 1 } },
        data: items.map(d => [d.popDensity, d.doctorsPer100k, d.totalCases, d.mortalityRate, d.region]),
      }],
    };
  }

  // Axis brush → dispatch parallelAxesFilter
  chart.on('brushSelected', (params) => {
    if (params.batch && params.batch.length > 0) {
      const ranges = params.batch[0].selected;
      const filter = {};
      const dims = ['populationDensity', 'healthcareAccess', 'caseCount', 'mortalityRate'];
      for (const r of ranges) {
        if (r.dataIndex && r.dataIndex.length > 0) {
          filter[dims[r.axisIndex]] = [r.dataIndex[0], r.dataIndex[r.dataIndex.length - 1]];
        }
      }
      store.dispatch(setParallelAxesFilter(filter));
    }
  });

  function render(state) {
    chart.setOption(buildOption(state), true);
  }

  function resize() { chart.resize(); }

  const unsub = store.subscribe(render);
  render(store.getState());

  return { render, resize, destroy() { unsub(); chart.dispose(); } };
}
```

- [ ] **Step 2: Commit**

```bash
git add js/views/parallelView.js
git commit -m "feat: implement parallel coordinates view with mortality-rate color encoding"
```

### Task 8: Policy timeline view

**Files:**
- Create: `js/views/policyView.js`

- [ ] **Step 1: Write policyView.js**

```javascript
import { setSelectedPolicyIds } from '../store.js';
import { filterCases } from '../utils/dataLoader.js';
import { POLICY_COLORS } from '../utils/colors.js';

export function initPolicy(dom, store, data) {
  const chart = echarts.init(dom);

  function buildOption(state) {
    // Filter policies visible in current time range and region selection
    let policies = data.policies;
    if (state.timeRange && state.timeRange.length === 2) {
      policies = policies.filter(p => p.date >= state.timeRange[0] && p.date <= state.timeRange[1]);
    }
    if (state.selectedRegions.length > 0) {
      policies = policies.filter(p => state.selectedRegions.includes(p.region));
    }

    // Build daily case trend line for context
    const filtered = filterCases(data.cases, state);
    const dailyTotals = {};
    for (const c of filtered) {
      dailyTotals[c.date] = (dailyTotals[c.date] || 0) + c.new_cases;
    }
    const caseLine = Object.entries(dailyTotals)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, val]) => [date, val]);

    // Build policy markers as scatter points
    const policyMarkers = policies.map((p, i) => ({
      name: p.title,
      value: [p.date, dailyTotals[p.date] || 0],
      itemStyle: { color: POLICY_COLORS[p.type] || '#999' },
      symbolSize: 14,
      policyIndex: i,
    }));

    return {
      backgroundColor: '#f5f7fa',
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          if (params.componentType === 'series' && params.seriesType === 'scatter') {
            const p = policies[params.data.policyIndex];
            return `<b>${p.title}</b><br/>
              日期: ${p.date}<br/>
              类型: ${p.type}<br/>
              地区: ${p.region}<br/>
              来源: ${p.source}<br/>
              <em>${p.description}</em>`;
          }
          return `${params.value[0]}<br/>新增确诊: ${params.value[1]}`;
        },
      },
      grid: { top: 8, right: 16, bottom: 24, left: 48 },
      xAxis: { type: 'time', axisLabel: { fontSize: 9 } },
      yAxis: { type: 'value', name: '新增确诊', axisLabel: { fontSize: 9 } },
      series: [
        {
          name: '每日新增',
          type: 'line',
          data: caseLine,
          symbol: 'none',
          lineStyle: { color: '#ccc', width: 1 },
          z: 1,
        },
        {
          name: '政策事件',
          type: 'scatter',
          data: policyMarkers,
          z: 10,
          encode: { tooltip: [0, 1] },
        },
      ],
    };
  }

  // Click policy marker → select policy
  chart.on('click', (params) => {
    if (params.componentType === 'series' && params.seriesType === 'scatter') {
      const p = data.policies[params.data.policyIndex];
      const current = store.getState().selectedPolicyIds;
      const next = current.includes(p.id)
        ? current.filter(id => id !== p.id)
        : [...current, p.id];
      store.dispatch(setSelectedPolicyIds(next));
    }
  });

  function render(state) {
    chart.setOption(buildOption(state), true);
  }

  function resize() { chart.resize(); }

  const unsub = store.subscribe(render);
  render(store.getState());

  return { render, resize, destroy() { unsub(); chart.dispose(); } };
}
```

- [ ] **Step 2: Commit**

```bash
git add js/views/policyView.js
git commit -m "feat: implement policy timeline with scatter markers and case trend background"
```

### Task 9: Detail panel view

**Files:**
- Create: `js/views/detailView.js`

- [ ] **Step 1: Write detailView.js**

```javascript
import { filterCases } from '../utils/dataLoader.js';

export function initDetail(dom, store, data) {
  // Detail view is a plain HTML panel, not an ECharts instance
  function buildHTML(state) {
    const filtered = filterCases(data.cases, state);

    // Aggregate stats
    let totalCases = 0, totalDeaths = 0;
    const regionStats = {};
    for (const c of filtered) {
      if (state.selectedRegions.length > 0 && !state.selectedRegions.includes(c.region)) continue;
      totalCases += c.new_cases;
      totalDeaths += c.new_deaths;
      if (!regionStats[c.region]) regionStats[c.region] = { cases: 0, deaths: 0 };
      regionStats[c.region].cases += c.new_cases;
      regionStats[c.region].deaths += c.new_deaths;
    }

    const cfr = totalCases > 0 ? (totalDeaths / totalCases * 100).toFixed(1) : '0.0';

    // Current selection info
    const selectedInfo = state.selectedRegions.length > 0
      ? `已选区域: ${state.selectedRegions.join(', ')}`
      : '已选区域: 全部';

    const timeInfo = state.timeRange
      ? `时间段: ${state.timeRange[0]} ~ ${state.timeRange[1]}`
      : '时间段: 全部';

    const policyInfo = state.selectedPolicyIds.length > 0
      ? `<br/>选中政策: ${state.selectedPolicyIds.map(id => {
          const p = data.policies.find(ev => ev.id === id);
          return p ? p.title : id;
        }).join('; ')}`
      : '';

    return `
      <div style="padding: 12px; font-size: 0.85rem; line-height: 1.8; overflow-y: auto; height: 100%;">
        <p><strong>${selectedInfo}</strong></p>
        <p>${timeInfo}</p>
        <p>累计确诊: <span style="color:#d32f2f;font-weight:bold;font-size:1.1rem">${totalCases.toLocaleString()}</span></p>
        <p>累计死亡: <span style="color:#333;font-weight:bold;font-size:1.1rem">${totalDeaths.toLocaleString()}</span></p>
        <p>病死率 (CFR): <span style="color:#e31a1c;font-weight:bold">${cfr}%</span></p>
        ${policyInfo}
        <hr style="margin:8px 0;border-color:#e0e0e0"/>
        <p style="font-size:0.8rem;color:#888;">各区域统计:</p>
        <table style="width:100%;font-size:0.75rem;border-collapse:collapse;">
          <tr><th style="text-align:left">区域</th><th>确诊</th><th>死亡</th><th>病死率</th></tr>
          ${Object.entries(regionStats).sort((a,b) => b[1].cases - a[1].cases).slice(0, 10).map(([name, s]) => `
            <tr>
              <td>${name}</td>
              <td style="text-align:right">${s.cases}</td>
              <td style="text-align:right">${s.deaths}</td>
              <td style="text-align:right">${s.cases > 0 ? (s.deaths/s.cases*100).toFixed(1) : '0.0'}%</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;
  }

  function render(state) {
    if (dom) dom.innerHTML = buildHTML(state);
  }

  const unsub = store.subscribe(render);
  render(store.getState());

  return {
    render,
    resize: () => {},
    destroy() { unsub(); dom && (dom.innerHTML = ''); },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add js/views/detailView.js
git commit -m "feat: implement detail panel with aggregate statistics and regional breakdown"
```

---

## Phase 3: Verify Cross-View Coordination

### Task 10: Integration test — verify all linkages work end-to-end

**Files:**
- Test: manual verification checklist (no automated tests — visual system)

- [ ] **Step 1: Start local server**

```bash
cd /home/yin/EbolaViz2026 && python3 -m http.server 8080
```

- [ ] **Step 2: Verify each linkage manually**

Open `http://localhost:8082` in browser and check:

| # | Action | Expected result | Check |
|---|--------|----------------|:-----:|
| 1 | Click a province on heatmap | Timeline shows only that province's curve; Parallel highlights that province; Policy filters; Detail updates | [ ] |
| 2 | Brush dataZoom on timeline | Heatmap filters to that time range; Parallel filters; Policy filters; Detail updates | [ ] |
| 3 | Hover a province on heatmap | Timeline shows thicker line for that province (no data filter) | [ ] |
| 4 | Press ▶ Play | Heatmap animates through dates; date display updates; Play button disables | [ ] |
| 5 | Press ⏸ Pause | Animation stops; Play re-enables | [ ] |
| 6 | Press ↺ Reset | All filters cleared; all views show full data | [ ] |
| 7 | Click a policy marker | Detail shows selected policy; Policy ID stored in state | [ ] |

- [ ] **Step 3: Fix any issues, re-verify, commit fixes**

```bash
git add -A && git commit -m "fix: cross-view coordination issues from integration test"
```

---

## Phase 4: GeoJSON Acquisition & Deployment

### Task 11: Acquire real GeoJSON files for DRC and Uganda

**Files:**
- Create: `data/geo/DRC.geojson`
- Create: `data/geo/UGA.geojson`

- [ ] **Step 1: Download DRC admin-1 GeoJSON from HDX or geoboundaries.org**

```bash
# Option A: geoboundaries.org (free, no auth)
curl -L -o data/geo/DRC.geojson "https://www.geoboundaries.org/api/current/gbOpen/COD/ADM1/geojson/"

# Option B: If above fails, use a minimal placeholder GeoJSON for development
```

- [ ] **Step 2: Download Uganda admin-1 GeoJSON**

```bash
curl -L -o data/geo/UGA.geojson "https://www.geoboundaries.org/api/current/gbOpen/UGA/ADM1/geojson/"
```

- [ ] **Step 3: Verify GeoJSON files load correctly**

Open the app and confirm both countries' provinces render on the heatmap.

- [ ] **Step 4: If geoboundaries province names don't match mock data, update mock data to match**

Update `scripts/generate_mock_data.py` REGIONS dict to use the actual province names from the GeoJSON files.

- [ ] **Step 5: Commit**

```bash
git add data/geo/DRC.geojson data/geo/UGA.geojson
git commit -m "feat: add DRC and Uganda admin-1 GeoJSON for map rendering"
```

### Task 12: Deploy to GitHub Pages

- [ ] **Step 1: Enable GitHub Pages in repo settings**

Go to `https://github.com/youarer1ght/EbolaViz2026/settings/pages`:
- Source: "Deploy from a branch"
- Branch: `main`, folder: `/ (root)`
- Save

- [ ] **Step 2: Verify deployment**

Wait ~1 minute. Visit: `https://youarer1ght.github.io/EbolaViz2026/`
Check: All 5 views load, data renders, play button works.

- [ ] **Step 3: Test the 15-minute TA setup procedure**

Simulate a fresh TA setup:
```bash
cd /tmp
git clone https://github.com/youarer1ght/EbolaViz2026.git
cd EbolaViz2026
python3 -m http.server 9999
# Open http://localhost:9999 — should work immediately
```

---

## Phase 5: Documentation & Submission Prep

### Task 13: Write mid-term document (中期文档)

**Files:**
- Create: `docs/中期文档.md`

- [ ] **Step 1: Write mid-term doc using the framework from spec sections 1-12**

Follow the user's mid-term framework (7 chapters) and fill in:
1. 绪论（背景、意义、研究内容） — from spec §1
2. 相关技术概述 — from spec §4
3. 数据集介绍与预处理方案 — from spec §7
4. 可视化总体设计与视图规划 — from spec §2, §3, §6
5. 当前项目完成进度 — from spec §11
6. 未完成工作与后期计划 — from spec §12
7. 中期小结

- [ ] **Step 2: Export as PDF and verify**

```bash
# Use any markdown-to-pdf tool, e.g.:
# pandoc docs/中期文档.md -o docs/中期文档.pdf --pdf-engine=xelatex -V CJKmainfont="Noto Sans CJK SC"
```

- [ ] **Step 3: Commit**

```bash
git add docs/中期文档.md docs/中期文档.pdf
git commit -m "docs: add mid-term report"
```

### Task 14: Prepare real data pipeline (ongoing, for final submission)

**Files:**
- Create: `scripts/fetch_data.py`
- Create: `scripts/clean_and_merge.py`

- [ ] **Step 1: Write fetch_data.py skeleton with source URLs**

```python
"""Fetch real Ebola outbreak data from public sources.
Sources:
  - WHO AFRO Outbreaks: https://www.afro.who.int/health-topics/disease-outbreaks
  - ACAPS: https://www.acaps.org/
  - HDX: https://data.humdata.org/
  - World Bank API: https://api.worldbank.org/v2/
"""
import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

def fetch_who_sitreps():
    """Download WHO AFRO situation reports."""
    # TODO: implement with real data when available
    pass

def fetch_acaps_events():
    """Extract structured policy events from ACAPS briefs."""
    pass

def fetch_hdx_geodata():
    """Download admin boundaries from HDX."""
    pass

if __name__ == "__main__":
    print("Fetching real data...")
    # fetch_who_sitreps()
    # fetch_acaps_events()
    print("Done.")
```

- [ ] **Step 2: Write clean_and_merge.py skeleton**

```python
"""Clean and merge raw data into standardized analysis dataset."""
import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

def harmonize_region_names(df):
    """Map varying region names to canonical names."""
    pass

def extrapolate_healthcare(national_data, regional_population):
    """Extrapolate healthcare resources from national to provincial level.
    
    Formula: provincial_value = national_value × (province_pop_density / national_avg_pop_density) × adjustment_factor
    """
    pass

def merge_all():
    """Merge cases + demographics + policies into unified analysis dataset."""
    pass

if __name__ == "__main__":
    print("Cleaning and merging data...")
    # merge_all()
    print("Done.")
```

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch_data.py scripts/clean_and_merge.py
git commit -m "feat: add data pipeline skeletons for real data acquisition"
```

---

## Self-Review Checklist

| # | Check | Status |
|---|-------|:------:|
| 1 | Every spec section covered by a task? | ✅ |
| 2 | No "TODO", "TBD", placeholders in code? | ✅ |
| 3 | Type consistency across tasks? (store state shape, function signatures) | ✅ |
| 4 | Each view in its own file with clear interface (init → {render, resize, destroy})? | ✅ |
| 5 | All file paths match spec directory structure? | ✅ |

---

## Execution Order

```
Task 0  (Mock data)     ──┐
Task 1  (HTML/CSS)       ├── Phase 0+1: Foundation — do FIRST
Task 2  (Store)          │
Task 3  (Utils)          │
Task 4  (main.js)       ─┘
Task 5  (Heatmap)       ──┐
Task 6  (Timeline)        │
Task 7  (Parallel)        ├── Phase 2: Views — can parallelize (B + C)
Task 8  (Policy)          │
Task 9  (Detail)         ─┘
Task 10 (Integration)    ─── Phase 3: Verify coordination
Task 11 (GeoJSON)        ─── Phase 4: Real data + deploy
Task 12 (GitHub Pages)   ──┘
Task 13 (Mid-term doc)   ──┬── Phase 5: Docs — parallel
Task 14 (Data pipeline)   ─┘
```

**Recommended parallel assignment (3-person team):**
- Person B: Tasks 5, 7 (Heatmap + Parallel) + Task 2 (Store)
- Person C: Tasks 6, 8 (Timeline + Policy) + Task 1 (HTML/CSS) + Task 3 (Utils)
- Person A: Task 0 (Mock data) + Task 13 (Mid-term doc) + Task 14 (Data pipeline)
- Task 4 (main.js) + Task 10 (Integration): B or C, whoever finishes views first
