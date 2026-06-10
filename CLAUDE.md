# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project overview

2026 年埃博拉疫情时空可视化分析系统 — a multi-view coordinated Ebola outbreak visualization web app. Pure frontend (vanilla JS + ECharts 5) deployed to GitHub Pages. No build tools, no Node.js, no framework — the only dependency is ECharts loaded via CDN.

Data preprocessing is done offline with Python scripts (`scripts/`), producing static JSON files in `data/` that the frontend loads via `fetch()`.

## Commands

```bash
# Development
cd /home/yin/EbolaViz2026
python3 -m http.server 8080 -b localhost        # Start dev server (Python 3 built-in)
# or: npx serve .                                # Alternative dev server

# Data
conda activate EBOLAVIZ                           # Activate Python env
python3 scripts/build_real_data.py                # Regenerate analysis datasets from CSV sources
# → Reads data/*.csv → validates consistency → outputs data/*.json
python3 scripts/fetch_who_sitrep.py --dry-run     # Fetch WHO AFRO SitRep PDFs (semi-automated)

# Data CSV files (editable by Role A — Excel / VS Code / any spreadsheet)
#   data/cases.csv           — case data: 159 real INSP records (5/14–5/28) + SEIR extrapolation (5/29–8/15), 10,557 total
#   data/demographics.csv    — 522 health zones: population, density, urban%, health sites
#   data/policy_events.csv   — 25 policy/humanitarian events (web-scraped from WHO/ReliefWeb/Africa CDC/news)
#   data/border_poe.csv      — 7 Uganda-DRC border crossings
#
# Data sources (all CC BY 4.0):
#
#   B.1 HDX — 2026 DRC/Uganda Bundibugyo Ebola official dataset (INSP daily cases)
#       https://data.humdata.org/event/crisis-ebola-bundibugyo-virus-disease
#   B.2 WHO — Disease Outbreak News (outbreak milestones, cross-border events, response)
#       https://www.who.int/emergencies/disease-outbreak-news
#   B.3 World Bank / HDX — admin boundaries, population, density, urban/rural, border PoE
#       https://data.worldbank.org/
#   B.4 WHO GHW / World Bank Health — beds, doctors/100k, health facility density
#       https://data.worldbank.org/topic/8
#   B.5 ReliefWeb — policy, lockdown, border screening, international aid events
#       https://reliefweb.int/
#   B.6 HDX Ebola archive — historical Ebola data for comparative analysis (optional)
#       https://data.humdata.org/ebola
#   B.7 License — all data CC BY 4.0, non-commercial academic use, fully attributable
#
#   Detailed sources:
#     INRB-UMIE/Ebola_DRC_2026 — primary: INSP daily cases, health zone shapefile, PoE
#     WorldPop — population counts & density per health zone
#     healthsites.io — health facility counts per health zone
#     FAO LCCS — satellite-derived urban fraction per health zone
#     CCVI — socioeconomic deprivation index
#     geoBoundaries — ADM1 province GeoJSON (DRC 26 + Uganda 4)

# Testing
node tests/smoke.test.js                           # Automated smoke test: all 5 views init + destroy OK
# Open http://localhost:8080 and verify:
#   - All 5 views render; heatmap shows split layout (left overview + right placeholder)
#   - Click province on heatmap → province selected, right panel shows zoomed province + zone markers
#   - Click zone marker on right panel → individual zone toggle
#   - dataZoom brush → other views update
#   - Click line in parallel coords → zone toggled, heatmap detail panel opens
#   - Click bar in detail panel → zone toggled
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
js/utils/dataLoader.js       — loadAllData() + filter helpers + stateKeysEqual()
    │
    ▼
js/main.js                   — Create Store, init 5 views, wire controls
    ├── js/store.js           — createStore() + reducer (observer pattern)
    ├── js/actions.js         — Action creators (pure functions)
    └── js/views/
        ├── heatmapView.js   — Choropleth + province zoom detail + zone selection
        ├── timelineView.js  — Multi-line chart + dataZoom
        ├── parallelView.js  — Parallel coordinates (province-color + mortality-opacity dual encoding)
        ├── policyView.js    — Policy event scatter markers
        └── detailView.js    — HTML summary panel
```

### State management (js/store.js)

Single global Store (~81 lines, hand-written observer pattern). All filter state lives here:

```javascript
store = {
  timeRange, animatingDate, isPlaying,     // Time
  selectedRegions, highlightedRegions,      // Space (filter vs highlight)
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
1. User interaction → `chart.on('click'|'datazoom', ...)` → `store.dispatch(action)`
2. Store reducer produces new state
3. Store notifies all subscribers → each view calls `render(newState)`

| User action | Dispatches | Affected views |
|-------------|-----------|----------------|
| dataZoom brush | `SET_TIME_RANGE` | heatmap, timeline, parallel, policy, detail |
| Click province on map | `SET_SELECTED_REGIONS` | heatmap (detail panel), timeline, parallel, policy, detail |
| Click zone marker in heatmap detail | `SET_SELECTED_REGIONS` | heatmap (both panels), timeline, parallel, detail |
| Click parallel line | `SET_SELECTED_REGIONS` | heatmap (detail panel), timeline, policy, detail |
| Click detail bar chart | `SET_SELECTED_REGIONS` | heatmap, timeline, parallel, policy, detail |
| Hover province on map | `SET_HIGHLIGHTED_REGIONS` | heatmap (border), timeline (line width) |
| Click policy marker | `SET_SELECTED_POLICY_IDS` | policy (markLines), detail |
| Play/Pause/Reset | `SET_ANIMATING_DATE` / `SET_IS_PLAYING` / `RESET_ALL` | all views |

## File responsibilities

| File | Responsibility | Size |
|------|---------------|------|
| `index.html` | SPA shell, 6 container divs (heatmap split layout), ECharts CDN, titlebar controls | ~66 lines |
| `css/style.css` | CSS Grid layout (5-view), heatmap split flexbox, detail overlay, policy type colors | ~106 lines |
| `js/store.js` | `createStore()`, reducer, action type constants, `getInitialState()` | ~81 lines |
| `js/actions.js` | 7 action creator functions (pure) | ~10 lines |
| `js/main.js` | Entry: load data → init Store → init 5 views → playback + keyboard | ~141 lines |
| `js/utils/dataLoader.js` | `loadAllData()`, `filterCases()`, `aggregateByRegion()`, `summarizeByRegion()`, `summarizeByProvince()`, `getTimeRange()`, `stateKeysEqual()` | ~194 lines |
| `js/utils/colors.js` | Color constants (TABLEAU, POLICY), `getRegionColor()` — choropleth uses its own 7-level palette | ~52 lines |
| `js/views/heatmapView.js` | Choropleth + split layout + province detail with real-coordinate zone markers + roam zoom | ~740 lines |
| `js/views/timelineView.js` | Multi-line chart, dataZoom → `SET_TIME_RANGE`, overview mode (aggregate + faded component lines) | ~220 lines |
| `js/views/parallelView.js` | Parallel coordinates, click-to-select + brush range filter + clear button | ~292 lines |
| `js/views/policyView.js` | Scatter markers + case trend background + staggered markLine labels | ~176 lines |
| `js/views/detailView.js` | Stats cards (HTML) + region ranking bar chart (ECharts) | ~245 lines |
| `scripts/build_real_data.py` | Assembles real data from WHO/World Bank/ReliefWeb sources | ~340 lines |

## Testing approach

5 套自动化测试，885 个断言，全部在 Node.js 运行，无需浏览器。

### 运行

```bash
node tests/unit.test.js           #  95 — 纯逻辑：store + actions + colors + dataLoader + stateKeysEqual
node tests/data.test.js           # 674 — 数据完整性：JSON 字段 / 交叉校验 / GeoJSON 结构 / 政策事件
node tests/option.test.js         #  78 — 视图合约：5 视图 init→render→reset→destroy 全生命周期
node tests/coordination.test.js   #  33 — 联动事件链：用户操作 → store.dispatch 验证
node tests/smoke.test.js          #   5 — 冒烟：5 视图 init/destroy（Mock ECharts + DOM）
```

### 各套件覆盖范围

| 套件 | 能检测 | 不能检测 |
|------|--------|---------|
| unit | reducer 纯函数、action 结构、filterCases 过滤逻辑、memoization | 视图渲染 |
| data | CSV 编辑错误、字段空缺、跨文件 region 不匹配、日期越界 | ECharts 配置 |
| option | init/render/resize/destroy 抛异常、state 变更后 render 崩溃 | 图表实际画了什么 |
| coordination | 交互逻辑断裂（删掉 click handler、改 dispatch type） | 视觉样式 |
| smoke | import 失败、模块导出错误、destroy 未清理 | 全部运行时行为 |

**修改视觉细节（颜色、大小、布局）不会触发任何测试失败**——这是刻意设计。测试只验证功能契约，不检查 ECharts option 的具体值。

### 手动验证清单

对于自动化测试覆盖不到的视觉部分：

1. **Data integrity**: `python3 scripts/build_real_data.py` must complete without errors
2. **View rendering**: Open `localhost:8080`, verify all 5 views render without console errors
3. **Coordination matrix**: Test all user-action rows in the coordination table above
4. **Edge cases**: Select 0 regions → all shown; select all regions → all shown; time range at boundaries
5. **Performance**: Window resize → all views resize smoothly; animation at 800ms/frame is stable
6. **Roam state**: Zoom/pan the heatmap → click a region or zone marker → zoom is preserved

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
5. **Real data with SEIR extrapolation**: 159 real INSP records (5/14–5/28); 10,557 total records generated via SEIR compartmental model + gravity-model spatial diffusion (5/29–8/15, documented in §2.6)
6. **Single-series choropleth with drag-optimised rendering**: Merged former two-series approach into one series — cuts map render passes from 2 to 1, eliminating drag stutter. Selection borders may clip at shared edges (ECharts borders are centred on polygon edges), but the performance win outweighs the visual trade-off. Additionally, mouseover is suppressed during roam-drag (detected via zrender mousedown/mousemove) to prevent expensive store.dispatch→render chains
7. **Province detail panel with zone scatter**: ADM1 choropleth at province level, health zone selection via zoomed scatter markers — bridges the geographic granularity gap without requiring health-zone GeoJSON boundaries
8. **Province-color + mortality-opacity dual encoding in parallel coordinates**: Each line = one health zone, color = province (categorical 15-color palette), opacity = zone mortality rate (higher CFR → more opaque, 0.25–0.90), selection = gold (#ff8f00) thick line — dual-channel encoding preserves both dimensions under filtering
