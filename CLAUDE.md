# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project overview

2026 年埃博拉疫情时空可视化分析系统 — a multi-view coordinated Ebola outbreak visualization web app. Pure frontend (vanilla JS + ECharts 5) deployed to GitHub Pages. No build tools, no Node.js, no framework — the only dependency is ECharts loaded via CDN.

Data preprocessing is done offline with Python scripts (`scripts/`), producing static JSON files in `data/` that the frontend loads via `fetch()`.

## Commands

```bash
# Development
cd /home/yin/EbolaViz2026
python3 -m http.server 8080                     # Start dev server (Python 3 built-in)
# or: npx serve .                                # Alternative dev server

# Data
conda activate EBOLAVIZ                           # Activate Python env
python3 scripts/build_real_data.py                # Regenerate analysis datasets
python3 scripts/generate_mock_data.py             # Generate synthetic dev data (fallback)

# Testing
node tests/smoke.test.js                           # Automated smoke test: all 5 views init + destroy OK
# Open http://localhost:8080 and verify:
#   - All 5 views render; heatmap shows split layout (left overview + right placeholder)
#   - Click province on heatmap → province selected, right panel shows zoomed province + zone markers
#   - Click zone marker on right panel → individual zone toggle
#   - dataZoom brush → other views update
#   - Press Space → animation plays
#   - Press R → all filters reset

# PDF generation
conda activate EBOLAVIZ
python3 -c "
import markdown2, weasyprint
from pathlib import Path
md = Path('docs/中期文档.md').read_text()
css = 'body{font-family:serif;font-size:12pt;line-height:1.8;max-width:800px;margin:40px auto} h2{border-bottom:2px solid #333} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ccc;padding:6px 10px} code{background:#f5f5f5;padding:1px 4px}'
html = f'<html><meta charset=utf-8><style>{css}</style><body>{markdown2.markdown(md, extras=[\"tables\",\"fenced-code-blocks\"])}</body></html>'
weasyprint.HTML(string=html).write_pdf('docs/中期文档.pdf')
print('PDF generated')
"

# Git
git push origin main
```

## Architecture

### Data flow

```
WHO AFRO / World Bank / ReliefWeb / HDX
    │
    ▼
scripts/build_real_data.py   — Python: clean, merge, output
    │
    ▼
data/*.json                  — Static files, loaded via fetch()
    │
    ▼
js/utils/dataLoader.js       — loadAllData() + filter helpers
    │
    ▼
js/main.js                   — Create Store, init 5 views, wire controls
    ├── js/store.js           — createStore() + reducer (observer pattern)
    ├── js/actions.js         — Action creators (pure functions)
    └── js/views/
        ├── heatmapView.js   — Choropleth (two-series overlay) + province zoom detail + zone selection
        ├── timelineView.js  — Multi-line chart + dataZoom
        ├── parallelView.js  — Parallel coordinates (per-zone mortality color)
        ├── policyView.js    — Policy event scatter markers
        └── detailView.js    — HTML summary panel
```

### State management (js/store.js)

Single global Store (~50 lines, hand-written observer pattern). All filter state lives here:

```javascript
store = {
  timeRange, animatingDate, isPlaying,     // Time
  selectedRegions, highlightedRegions,      // Space (separate: filter vs highlight)
  parallelAxesFilter,                       // Multi-dimension
  selectedPolicyIds,                        // Policy
}
```

`selectedRegions` triggers global data filtering (persistent). `highlightedRegions` triggers visual emphasis only (transient — mouse hover). This separation prevents hover from triggering expensive re-renders across all views.

### View interface

Every view exports `init(domElement, store, data)` → `{ render, resize, destroy }`:

- `init()` creates the ECharts instance, registers event handlers, subscribes to store
- `render(state)` builds ECharts option from state, calls `chart.setOption()`
- `resize()` calls `chart.resize()` (called on `window.resize`)
- `destroy()` unsubscribes from store, disposes ECharts instance

### Coordination (Brushing & Linking)

All views follow the same pattern:
1. User interaction → `chart.on('click'|'datazoom'|'brushselected', ...)` → `store.dispatch(action)`
2. Store reducer produces new state
3. Store notifies all subscribers → each view calls `render(newState)`

| User action | Dispatches | Affected views |
|-------------|-----------|----------------|
| dataZoom brush | `SET_TIME_RANGE` | heatmap, parallel, policy, detail |
| Click province on map | `SET_SELECTED_REGIONS` | heatmap (detail panel), timeline, parallel, policy, detail |
| Click zone marker in detail | `SET_SELECTED_REGIONS` | heatmap (both panels), timeline, parallel, detail |
| Hover province on map | `SET_HIGHLIGHTED_REGIONS` | heatmap (overlay border), timeline (line width) |
| Brush parallel axes | `SET_PARALLEL_AXES_FILTER` | heatmap, timeline, policy, detail |
| Click policy marker | `SET_SELECTED_POLICY_IDS` | heatmap (markLines), detail |
| Play/Pause/Reset | `SET_ANIMATING_DATE` / `SET_IS_PLAYING` / `RESET_ALL` | all views |

## File responsibilities

| File | Responsibility | Size |
|------|---------------|------|
| `index.html` | SPA shell, 6 container divs (heatmap split layout), ECharts CDN, titlebar controls | ~60 lines |
| `css/style.css` | CSS Grid layout (5-view), heatmap split flexbox, detail overlay, policy type colors | ~115 lines |
| `js/store.js` | `createStore()`, reducer, action type constants, `getInitialState()` | ~75 lines |
| `js/actions.js` | 9 action creator functions (pure) | ~15 lines |
| `js/main.js` | Entry: load data → init Store → init 5 views → playback + keyboard | ~100 lines |
| `js/utils/dataLoader.js` | `loadAllData()`, `filterCases()`, `aggregateByRegion()`, `summarizeByRegion()` | ~100 lines |
| `js/utils/colors.js` | Color constants (HEATMAP, TABLEAU, POLICY), `getRegionColor()`, `heatmapColor()` | ~50 lines |
| `js/views/heatmapView.js` | Choropleth (two-series border overlay) + split layout + province zoom detail with zone markers | ~620 lines |
| `js/views/timelineView.js` | Multi-line chart, dataZoom → `SET_TIME_RANGE` | ~80 lines |
| `js/views/parallelView.js` | Parallel coordinates, brush → `SET_PARALLEL_AXES_FILTER` | ~90 lines |
| `js/views/policyView.js` | Scatter markers + case trend background | ~100 lines |
| `js/views/detailView.js` | HTML panel: stats cards + region table | ~100 lines |
| `scripts/build_real_data.py` | Assembles real data from WHO/World Bank/ReliefWeb sources | ~170 lines |

## Testing approach

This is a visual analytics system — testing is primarily manual verification:

1. **Data integrity**: `python3 scripts/build_real_data.py` must complete without errors
2. **View rendering**: Open `localhost:8080`, verify all 5 views render without console errors
3. **Coordination matrix**: Test all 6 user-action rows in the coordination table above
4. **Edge cases**: Select 0 regions → all shown; select all regions → all shown; time range at boundaries
5. **Performance**: Window resize → all views resize smoothly; animation at 800ms/frame is stable

For automated checks, verify:
- `store.js`: reducer is a pure function (same input → same output, no mutations)
- `dataLoader.js`: filter functions handle null/empty inputs gracefully
- All views: `destroy()` properly cleans up subscriptions and ECharts instances

## Conventions

### JavaScript
- ES modules (`<script type="module">` in HTML)
- No build step, no transpilation — write browser-compatible JS
- One file per view, named `<viewName>View.js`
- Views export `init(dom, store, data)` → `{ render, resize, destroy }`
- Use `const` and `let`, never `var`
- Use arrow functions for callbacks, regular functions for module exports

### Data
- JSON files in `data/` must be valid UTF-8
- Region names must match between `cases`, `demographics`, and `policies`
- Date format: `YYYY-MM-DD` string

### Git
- Branches: `feat/<name>` or `fix/<name>`
- Commits: follow conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- Push to `main` directly OK for this course project (no PR requirement)

### Key design decisions (defendable at oral exam)

1. **Centralized Store**: Hand-written ~50 lines vs importing a state library — simpler, fully explainable
2. **selectedRegions vs highlightedRegions**: Persistent filter vs transient highlight — prevents unnecessary re-rendering
3. **dataZoom as sole time filter**: Removed redundant titlebar slider — ECharts dataZoom is the single source of truth
4. **Pure frontend static deploy**: No backend — TA can run it in 15 minutes with just Python 3
5. **Real data with extrapolation**: Core epidemiological data is real; healthcare data extrapolated from national to provincial level with documented formulas
6. **Two-series choropleth overlay**: Base layer (uniform thin borders) + transparent overlay (thick selection borders) — solves ECharts single-series shared-edge border clipping
7. **Province detail panel with zone scatter**: ADM1 choropleth at province level, health zone selection via zoomed scatter markers — bridges the geographic granularity gap without requiring health-zone GeoJSON boundaries
8. **Health-zone mortality color in parallel coordinates**: Each line = one health zone, color encoded by zone mortality rate (green→red), selection shown via line width/opacity — preserves data encoding even when filtered
