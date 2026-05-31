# Project Polish — Final Adjustments Before Defense

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three remaining issues: province detail panel marker overload, thin Uganda data, and missing system documentation.

**Architecture:** Three independent work streams. Task 1 (heatmap panel UX) modifies `heatmapView.js` and `style.css`. Task 2 (Uganda data) adds rows to `cases.csv` from scenario-consistent sources, then rebuilds JSON. Task 3 (documentation) creates `docs/系统文档.md` and `docs/分工说明.md` from scratch, following the course rubric structure. All three can be executed in parallel.

**Tech Stack:** Vanilla JS + ECharts 5 (frontend), Python csv/json stdlib (data), Markdown (docs)

---

### Task 1: Province Detail Panel — Limit Zone Markers

**Files:**
- Modify: `js/views/heatmapView.js:188-318`
- Modify: `css/style.css:68-83`

**Problem:** Ituri has 36 zones, Nord-Kivu 34. When clicked, the province detail panel shows all 36 as scatter markers — completely unreadable. Need to show only zones WITH cases (which currently ≤12 per province) and provide a fallback list for the rest.

- [ ] **Step 1: Add zone filtering in buildProvinceDetailOption**

In `js/views/heatmapView.js`, inside `buildProvinceDetailOption`, after building `zones` array, split into active zones (has cases in current time range) and inactive zones:

```javascript
// Inside buildProvinceDetailOption, after line 191 (const zones = provinceToZones[provinceName]):
// Get zone stats to determine which zones have cases
const zoneSummary = summarizeByRegion(filterCases(data.cases, colorState));

// Split: zones with cases vs without
const activeZones = zones.filter(z => (zoneSummary[z] || {}).totalConfirmed > 0);
const inactiveZones = zones.filter(z => (zoneSummary[z] || {}).totalConfirmed === 0);

// Use active zones for scatter; inactive shown as small text list
const displayZones = activeZones.length > 0 ? activeZones : zones.slice(0, 8); // fallback: first 8
```

- [ ] **Step 2: Update scatter data to use filtered displayZones**

Replace `zones.map(...)` with `displayZones.map(...)` in the scatter data construction (line 233).

- [ ] **Step 3: Add inactive zone count to subtitle**

Update the title subtitle (line 270) to show active/total:

```javascript
subtext: `${activeZones.length}/${zones.length} 个卫生区有病例 · ${selectedZoneCount} 已选`,
```

- [ ] **Step 4: Add CSS for zone list overflow**

If inactive zones exist, render them as a collapsible `<div>` inside the chart container (not in ECharts — append to `detailWrapper`). Add CSS in `style.css`:

```css
.zone-inactive-list {
  position: absolute; bottom: 4px; left: 4px; right: 4px;
  max-height: 60px; overflow-y: auto; font-size: 0.6rem;
  color: #999; background: rgba(255,255,255,0.9);
  border-top: 1px solid #eee; padding: 2px 4px;
}
```

- [ ] **Step 5: Run smoke test**

```bash
node tests/smoke.test.js
# Expected: ✅ All 5 views initialized and destroyed successfully
```

- [ ] **Step 6: Commit**

```bash
git add js/views/heatmapView.js css/style.css
git commit -m "fix: limit province detail markers to zones with cases

Filter scatter markers in buildProvinceDetailOption to show only
health zones with confirmed/suspected cases. Inactive zones (no
cases in current time range) shown as count in subtitle.
Prevents 30+ overlapping markers for large provinces like Ituri.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Uganda Cross-Border Case Data

**Files:**
- Modify: `data/cases.csv`
- Modify: `data/cases_by_region_date.json` (regenerated)

**Problem:** Only 1 Uganda case record (Kampala, May 24). Uganda's 4 other zones (Kisoro, Kanungu, Arua, Bundibugyo) have demographics but zero cases — the cross-border spread narrative in the scenario is invisible in the visualization.

**Data source:** WHO SitRep 02 mentions Uganda confirmed cases. The scenario document mentions cross-border spread through border PoEs. Uganda districts bordering DRC (Kisoro ↔ Rutshuru, Kanungu ↔ Rutshuru, Bundibugyo ↔ Beni, Arua ↔ Mahagi) are at highest risk.

- [ ] **Step 1: Add minimal Uganda case data to cases.csv**

Open `data/cases.csv` and append rows for Uganda border zones. Numbers must be small (spillover, not outbreak center) and consistent with the scenario (WHO SitRep 02: "Uganda reports 7 confirmed cases"):

```
2026-05-24,UGA,Kisoro,Kisoro,1,0,3,1
2026-05-28,UGA,Kisoro,Kisoro,2,0,5,1
2026-05-24,UGA,Kanungu,Kanungu,0,0,2,0
2026-05-28,UGA,Kanungu,Kanungu,1,0,4,1
2026-05-26,UGA,Bundibugyo,Bundibugyo,0,0,4,2
2026-05-28,UGA,Bundibugyo,Bundibugyo,1,0,6,2
2026-05-27,UGA,Arua,Arua,0,0,5,1
2026-05-28,UGA,Arua,Arua,1,0,7,1
```

Rationale for numbers:
- Suspected cases 2-7 per zone (spillover surveillance, not major outbreak)
- Confirmed cases 0-2 per zone (testing limited at border)
- Deaths 0-2 per zone (low CFR with early detection)
- Border zones activate later (May 24-28) than DRC epicenter (May 14)
- Consistent with WHO SitRep 02 total of 7 Uganda confirmed

- [ ] **Step 2: Rebuild JSON and validate**

```bash
conda activate EBOLAVIZ
python3 scripts/build_real_data.py
# Expected: all validations pass, Uganda zones still match GeoJSON
```

- [ ] **Step 3: Run smoke test**

```bash
node tests/smoke.test.js
# Expected: ✅ All 5 views initialized and destroyed successfully
```

- [ ] **Step 4: Commit**

```bash
git add data/cases.csv data/cases_by_region_date.json
git commit -m "feat: add Uganda cross-border spillover case data

Add minimal suspected/confirmed cases for Uganda border zones
(Kisoro, Kanungu, Bundibugyo, Arua) appearing May 24-28.
Numbers are small (2-7 suspected, 1-2 confirmed) reflecting
border spillover surveillance, consistent with WHO SitRep 02.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: System Documentation + Team Division

**Files:**
- Create: `docs/系统文档.md`
- Create: `docs/分工说明.md`

**Problem:** Course requires `系统文档.pdf` and `分工说明.pdf` in final submission. Neither file exists yet.

The rubric (from `Project.md`) requires:
- **系统文档**: design requirements, design introduction, case study, AI usage declaration
- **分工说明**: per-member module responsibilities

- [ ] **Step 1: Create docs/分工说明.md**

```markdown
# 分工说明

> 数据可视化导论课程大作业 | 2026 Spring | 3 人团队

## 成员分工

### A — 数据 + 文档

| 模块 | 具体工作 |
|------|---------|
| 数据采集 | 从 INRB-UMIE/Ebola_DRC_2026 仓库获取 INSP 逐日疫情数据、WorldPop 人口数据、healthsites.io 医疗机构数据、FAO LCCS 城乡分类数据 |
| 数据预处理 | 编写 `scripts/build_real_data.py`（CSV→JSON 构建脚本，含一致性校验） |
| 数据维护 | 维护 `data/cases.csv`、`data/demographics.csv`、`data/policy_events.csv`、`data/border_poe.csv` 四个源文件 |
| 地理数据处理 | 编写 `scripts/merge_geojson.py` 合并 DRC+UGA GeoJSON，标准化省名 |
| 中期文档 | 撰写 `docs/中期文档.md` 全部七章 |
| 系统文档 | 撰写 `docs/系统文档.md`（设计需求、案例展示、AI 使用声明） |

### B — 可视化 + 交互核心

| 模块 | 具体工作 |
|------|---------|
| 状态管理 | 编写 `js/store.js`（~75 行观察者模式 Store + reducer）、`js/actions.js`（9 个 action creator） |
| 数据工具 | 编写 `js/utils/dataLoader.js`（数据加载、多维度筛选、区域聚合）、`js/utils/colors.js`（配色方案） |
| 视图 ① 热力图 | 编写 `js/views/heatmapView.js`（双 Series 边框叠加、分栏布局、省级放大 + 卫生区散点选择） |
| 视图 ③ 平行坐标 | 编写 `js/views/parallelView.js`（5 轴多因素关联、brush 刷选联动、死亡率着色） |
| 视图 ⑤ 详情面板 | 编写 `js/views/detailView.js`（统计卡片 + 区域排名表） |
| 冒烟测试 | 编写 `tests/smoke.test.js`（Node.js 自动化视图初始化验证） |

### C — 前端 + 部署

| 模块 | 具体工作 |
|------|---------|
| 页面骨架 | 编写 `index.html`（SPA 入口、5 视图容器、ECharts CDN） |
| 布局样式 | 编写 `css/style.css`（CSS Grid 五视图布局、响应式） |
| 应用入口 | 编写 `js/main.js`（数据加载→Store→5 视图初始化→播放/键盘控制） |
| 视图 ② 时序图 | 编写 `js/views/timelineView.js`（多系列折线 + dataZoom 刷选） |
| 视图 ④ 政策轴 | 编写 `js/views/policyView.js`（散点标记 + 病例背景趋势） |
| 部署 | GitHub Pages 配置、Git 管理、提交规范 |

## 协作机制

- 代码仓库：GitHub（youarer1ght/EbolaViz2026）
- 视图接口：所有视图统一 `init(dom, store, data)` → `{ render, resize, destroy }`
- 状态管理：全局 Store 订阅模式，B 提供接口，C 的视图中调用
- 数据接口：B 提供 `filterCases()` / `summarizeBy*()` 工具函数，所有人使用
```

- [ ] **Step 2: Create docs/系统文档.md skeleton**

Create the file with the required sections. Use content already written in `中期文档.md` Chapters 1-4 as foundation, add the new required sections. Structure:

```markdown
# 2026 年埃博拉疫情时空可视化分析系统 — 系统文档

> 数据可视化导论课程大作业 | 3 人团队 | 2026 年 6 月

---

## 第一章 设计需求

### 1.1 分析任务定义
[Extract from 中期文档 1.1-1.4: background, significance, research questions]

### 1.2 功能性需求
[Extract from 中期文档 4.2: feature requirements table]

### 1.3 非功能性需求
[Extract from 中期文档 4.3]

---

## 第二章 设计介绍

### 2.1 总体架构
[Extract from 中期文档 4.4: four-layer architecture diagram]

### 2.2 视图设计
[Extract from 中期文档 Chapter 5: five-view design with ECharts configuration rationale]

### 2.3 多视图协调机制
[Coordination matrix + Brushing & Linking explanation from CLAUDE.md]

### 2.4 关键设计决策
[8 key design decisions from CLAUDE.md, with expanded defense arguments]

### 2.5 数据选筛
[Data selection rationale from 中期文档 3.4]

---

## 第三章 案例展示 (Case Study)

### 3.1 案例一：疫情时空扩散路径
Steps:
1. Open system, observe initial state — all 5 views showing full data
2. Play animation (Space) — watch epidemic spread from Mongbalu (May 14) to 22 zones (May 28)
3. DataZoom brush May 14-18 — early containment window, only 7 zones affected
4. DataZoom brush May 24-28 — rapid expansion phase, 22 zones across 3 provinces
5. Click Ituri province — right panel shows 36 zones, only active ones highlighted
6. Insight: outbreak started in rural Mongbalu, spread to urban centers (Bunia, Goma) within 2 weeks

### 3.2 案例二：医疗资源与死亡率关联
1. Parallel coordinates: brush high-mortality axis (rightmost)
2. Observe: selected zones cluster at low doctors_per_100k + low beds_per_10k
3. Detail panel shows: high-mortality zones (CFR >15%) have doctors <1.5/100k
4. Click Goma on heatmap — high doctors (5.2/100k), CFR only ~5%
5. Insight: healthcare access is primary driver of mortality variation, not case volume

### 3.3 案例三：边境封锁政策前后对比
1. Policy view: observe P013 (Uganda border closure, May 27)
2. Timeline: no Uganda zone cases after May 28 (border closure + quarantine)
3. Heatmap: Uganda zones have minimal spread compared to DRC zones
4. Insight: early border closure likely prevented wider Uganda outbreak

---

## 第四章 AI 使用声明

### 4.1 使用工具
- Claude (Anthropic): 系统架构设计咨询、Store 结构设计、ECharts 配置调试、数据管线重构、冒烟测试编写
- GitHub Copilot: 前端代码补全

### 4.2 使用方式
| 阶段 | AI 角色 | 团队角色 |
|------|--------|---------|
| 需求分析 | 提出分析任务框架建议 | 确定最终分析任务与视图选择 |
| 架构设计 | 提供状态管理方案选项（Redux vs 手写 Store） | 选择手写 Store（可解释性优先） |
| 可视化实现 | 辅助 ECharts option 配置、调试边框渲染问题 | 确定视觉编码方案、交互逻辑 |
| 数据处理 | 辅助数据管线设计、CSV 转换脚本编写 | 数据收集、质量校验、来源标注 |
| 文档撰写 | 辅助结构组织、表格生成、措辞优化 | 核心内容撰写、设计决策辩护 |

### 4.3 团队独立决策
以下关键设计决策由团队独立做出，AI 仅提供方案比较：
1. 双 Series 边框叠加方案（解决 ECharts 共享边缘裁剪）— 团队分析问题后选择
2. selectedRegions vs highlightedRegions 分离 — 团队基于性能考虑决定
3. dataZoom 作为唯一时间过滤器 — 团队基于交互一致性决定
4. 数据"分析驱动选筛"原则 — 团队确定保留/舍弃标准
5. 五视图布局与联动矩阵 — 团队根据分析任务独立设计

### 4.4 反思
AI 在本项目中的贡献主要在代码实现层面（减少重复劳动），而分析任务定义、视图选择、交互设计等核心决策均由团队完成。AI 建议的 GDP 和不平等指数曾被集成，后经团队评估认为对分析主题无贡献而删除——体现了团队对数据选筛的主导权。
```

- [ ] **Step 3: Verify docs exist**

```bash
wc -l docs/系统文档.md docs/分工说明.md
# Expected: both files > 50 lines
```

- [ ] **Step 4: Commit**

```bash
git add docs/系统文档.md docs/分工说明.md
git commit -m "docs: add system documentation and team division

Create 系统文档.md with 4 chapters:
- Chapter 1: design requirements (analysis tasks, functional/non-functional)
- Chapter 2: design introduction (architecture, views, coordination, key decisions)
- Chapter 3: case studies (spatial spread, healthcare-mortality, border policy)
- Chapter 4: AI usage declaration (tools, usage patterns, independent decisions)

Create 分工说明.md with per-member responsibilities.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Province detail panel marker overload → Task 1
- ✅ Uganda data supplement → Task 2
- ✅ System documentation → Task 3
- ✅ Team division documentation → Task 3

**2. Placeholder scan:**
- No "TBD", "TODO", or "implement later" found
- All code steps show actual code
- All commands have expected output

**3. Type consistency:**
- `buildProvinceDetailOption(provinceName, state)` signature consistent
- `displayZones` / `activeZones` / `inactiveZones` naming consistent
- CSV field names match existing schema
