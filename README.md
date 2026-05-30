# EbolaViz2026 — 2026 年埃博拉疫情时空可视化分析系统

> 数据可视化导论课程大作业 | 3 人团队 | 2026 Spring

---

## 📋 前置要求

### 必需

- **现代浏览器**（Chrome / Edge / Firefox，需支持 ES Modules）
- **Python 3.8+**（用于本地开发服务器，系统通常已自带）
- **Git**（版本控制）

### 可选

- **Conda**（用于独立的 `EBOLAVIZ` Python 环境，推荐）

---

## 🚀 快速开始（助教 15 分钟搭建）

### 0. 克隆仓库

```bash
git clone https://github.com/youarer1ght/EbolaViz2026.git
cd EbolaViz2026
```

### 1. 启动开发服务器（二选一）

**方式一：Python 内置服务器（推荐，零额外依赖）**

```bash
python3 -m http.server 8080
# 如果 8080 端口被占用，换一个端口即可：
# python3 -m http.server 8888
# python3 -m http.server 3000
```

**方式二：npx（需 Node.js）**

```bash
npx serve .
```

> ⚠️ **端口说明**：上例使用 8080，但该端口可能已被占用。启动后注意终端输出的实际端口号，浏览器打开 `http://localhost:<实际端口>` 即可。本文档后续示例统一写 `localhost:8080`，请替换为你实际使用的端口。

### 2. 浏览器打开

```
http://localhost:8080
```

预期看到 5 个可视化视图的网格布局，控制台输出 `✅ EbolaViz2026 ready.`。

---

## 🐍 Conda 独立环境（用于数据处理 & PDF 导出）

如果你需要运行数据脚本或导出文档 PDF，建议创建独立的 Conda 环境：

### 创建环境

```bash
# 创建名为 EBOLAVIZ 的 Python 3.12 环境
conda create -n EBOLAVIZ python=3.12 -y

# 激活环境
conda activate EBOLAVIZ
```

### 安装依赖

```bash
# 数据处理（真实数据构建）
pip install pandas numpy

# PDF 导出（中期/系统文档 → PDF）
pip install markdown2 weasyprint
```

### 验证安装

```bash
python3 -c "import pandas, numpy, markdown2; print('✅ 环境就绪')"
```

### 使用示例

```bash
conda activate EBOLAVIZ

# 重新生成分析数据集
python3 scripts/build_real_data.py

# 合并行政区划 GeoJSON
python3 scripts/merge_geojson.py

# 导出中期文档为 PDF
python3 -c "
import markdown2, weasyprint
from pathlib import Path
md = Path('docs/中期文档.md').read_text()
css = 'body{font-family:serif;font-size:12pt;line-height:1.8;max-width:800px;margin:40px auto} h2{border-bottom:2px solid #333;padding-bottom:4px;margin-top:24px} h1{font-size:18pt;text-align:center} table{border-collapse:collapse;width:100%;margin:12px 0} th,td{border:1px solid #ccc;padding:6px 10px} th{background:#f0f0f0} code{background:#f5f5f5;padding:1px 4px} pre{background:#f5f5f5;padding:12px;font-size:9pt}'
html = f'<html><meta charset=utf-8><style>{css}</style><body>{markdown2.markdown(md, extras=[\"tables\",\"fenced-code-blocks\"])}</body></html>'
weasyprint.HTML(string=html).write_pdf(str(md_path.with_suffix('.pdf')))
print('✅ PDF generated')
"
```

### 依赖清单

| 包 | 用途 | 安装方式 |
|----|------|----------|
| `pandas` | 数据清洗、合并、聚合 | `pip install pandas` |
| `numpy` | 数值计算（数据推算） | `pip install numpy` |
| `markdown2` | Markdown → HTML 转换 | `pip install markdown2` |
| `weasyprint` | HTML → PDF 导出 | `pip install weasyprint` |

---

## 🏗 系统架构

```
展示层:  5 个 ECharts 视图 (heatmap, timeline, parallel, policy, detail)
事件层:  用户交互 → dispatch(action)
状态层:  全局 Store (手写 ~75 行观察者模式)
数据层:  静态 JSON 文件 (WHO AFRO SitReps, World Bank, ReliefWeb, geoboundaries)
```

### 项目结构

```
EbolaViz2026/
├── index.html                   # SPA 入口 + 5 视图容器 + ECharts CDN
├── css/
│   └── style.css                # CSS Grid 五视图布局 + 政策类型配色
├── js/
│   ├── main.js                  # 入口: 加载数据 → 初始化 Store → 5 视图 → 键盘/播放
│   ├── store.js                 # createStore() + reducer (~75行)
│   ├── actions.js               # 9 个 action creator 函数
│   ├── views/
│   │   ├── heatmapView.js       # ① 时空热力图 (choropleth 为主 + scatter fallback)
│   │   ├── timelineView.js      # ② 时序趋势图 + dataZoom
│   │   ├── parallelView.js      # ③ 平行坐标图 (多因素关联)
│   │   ├── policyView.js        # ④ 防控政策时间轴
│   │   └── detailView.js        # ⑤ 统计详情面板 (HTML)
│   └── utils/
│       ├── dataLoader.js        # 数据加载 + 过滤/聚合工具
│       └── colors.js            # 配色方案 (HEATMAP, TABLEAU, POLICY)
├── data/
│   ├── cases_by_region_date.json  # 病例时序数据 (WHO AFRO SitReps)
│   ├── demographics.json          # 人口/医疗资源 (World Bank/WHO GHO)
│   ├── policy_events.json         # 防控政策事件 (WHO DON/ReliefWeb)
│   ├── border_poe.json            # 边境口岸坐标 (OSM)
│   └── geo/
│       ├── DRC.geojson            # 刚果(金) 26 省 ADM1 边界
│       ├── UGA.geojson            # 乌干达 4 大区 ADM1 边界
│       ├── outbreak_region.geojson # 合并跨境地图 (热力图使用)
│       └── uga_district_region_map.json  # 乌干达 district→大区 映射
├── scripts/
│   ├── build_real_data.py         # 真实数据构建 (WHO/World Bank/ReliefWeb)
│   ├── generate_mock_data.py      # Mock 数据生成 (开发 fallback, 不推荐)
│   ├── merge_geojson.py           # 合并 DRC+UGA GeoJSON + 名称标准化
│   └── requirements.txt           # Python 依赖列表
└── docs/
    ├── 中期文档.md / .pdf
    ├── 系统文档.md
    └── 分工说明.md
```

### 数据来源

| 数据集 | 来源 | 许可 |
|--------|------|------|
| 病例数据 | [WHO AFRO Weekly SitReps](https://www.afro.who.int/) + [kraemer-lab/Ebola_DRC_2026](https://github.com/kraemer-lab/Ebola_DRC_2026) | WHO Open Access / CC BY 4.0 |
| 人口地理 | [World Bank Open Data](https://data.worldbank.org/) + [HDX](https://data.humdata.org/) | CC BY 4.0 |
| 行政区划 | [geoBoundaries](https://www.geoboundaries.org/) | CC BY 4.0 |
| 医疗资源 | [WHO GHO](https://www.who.int/data/gho) + [GRID3](https://data.grid3.org/) | CC BY 4.0 |
| 政策事件 | [WHO DON 605](https://www.who.int/emergencies/disease-outbreak-news) + [ReliefWeb](https://reliefweb.int/) | CC BY 4.0 |
| 边境口岸 | [kraemer-lab/Ebola_DRC_2026](https://github.com/kraemer-lab/Ebola_DRC_2026) (OSM) | ODbL |

---

## 👥 组员分工（具体到文件）

### A 角色：数据 + 文档

> 负责数据获取、清洗、预处理脚本，以及中期/系统文档撰写。

| 类别 | 具体文件 | 说明 |
|:-----|---------|------|
| 数据构建 | `scripts/build_real_data.py` | **核心**：从 WHO/World Bank/ReliefWeb 构建真实数据集 |
| 数据构建 | `scripts/merge_geojson.py` | 合并 DRC+UGA 行政区划 GeoJSON，标准化地名 |
| Mock 备用 | `scripts/generate_mock_data.py` | 合成测试数据生成器（仅当无法获取真实数据时使用） |
| 依赖清单 | `scripts/requirements.txt` | Python 包依赖 (pandas, numpy, markdown2, weasyprint) |
| 数据文件 | `data/cases_by_region_date.json` | 病例时序数据输出（由 build_real_data.py 生成） |
| 数据文件 | `data/demographics.json` | 人口医疗数据输出 |
| 数据文件 | `data/policy_events.json` | 政策事件数据输出 |
| 数据文件 | `data/border_poe.json` | 边境口岸坐标输出 |
| 原始数据 | `data/epi_cases_weekly.csv` | WHO 周报原始数据 |
| 原始数据 | `data/aliases.csv` | 地名标准化映射 |
| 原始数据 | `data/poe_coordinates.csv` | 口岸原始坐标 |
| 原始数据 | `data/epi_metadata.yaml` | 数据元信息（来源 URL、引用格式） |
| 文档 | `docs/中期文档.md` | **核心**：7 章中期报告（后可转为系统文档） |
| 文档 | `docs/系统文档.md` | 最终系统文档（case study、设计决策、答辩要点） |
| 文档 | `docs/分工说明.md` | 组员分工详细说明 |

**技能要求**：Python 数据处理 (pandas)、数据源调研、学术写作

---

### B 角色：可视化 + 交互（核心）

> 负责全局状态管理、数据流转，以及 3 个最复杂的可视化视图。

| 类别 | 具体文件 | 说明 |
|:-----|---------|------|
| 状态核心 | `js/store.js` | **核心**：全局 Store 实现 + reducer 纯函数 + 初始状态 |
| 状态核心 | `js/actions.js` | 9 个 action creator（setTimeRange, setSelectedRegions 等） |
| 状态核心 | `js/utils/dataLoader.js` | 数据加载、多维度筛选 (filterCases)、聚合 (summarizeByRegion/Province) |
| 配色系统 | `js/utils/colors.js` | HEATMAP 渐变、TABLEAU 10 色、POLICY 5 类型色 |
| 视图 ① | `js/views/heatmapView.js` | **Choropleth 热力图**：GeoJSON 底图 + 省级填充 + 点击选中 |
| 视图 ③ | `js/views/parallelView.js` | **平行坐标图**：5 轴 (人口/医生/病例/死亡率/床位) + brush 筛选 |
| 视图 ⑤ | `js/views/detailView.js` | **统计详情面板**：卡片 + 排名表（纯 HTML 渲染，无 ECharts） |

**视图职责细节**：

- **热力图**：注册合并 GeoJSON → `map` 系列 → 省份聚合着色 → 点击省份选中全部子区域 → 鼠标悬浮高亮
- **平行坐标**：5 个数值维度 → 按死亡率着色 → brushSelected → `SET_PARALLEL_AXES_FILTER` → 联动所有视图
- **详情面板**：读取 state → 计算选定区域 summary → 渲染统计卡片 + 区域排序表

**技能要求**：ECharts 配置、状态管理、数据流设计、多视图协调

---

### C 角色：前端 + 部署

> 负责页面骨架、布局样式、时序/政策两个视图，以及 Git 管理和发布。

| 类别 | 具体文件 | 说明 |
|:-----|---------|------|
| 页面骨架 | `index.html` | SPA 入口：5 个视图容器 DOM + ECharts CDN + 标题栏按钮 |
| 布局样式 | `css/style.css` | CSS Grid 五视图布局 + 响应式断点 + 图表容器样式 |
| 应用入口 | `js/main.js` | **核心**：加载数据 → 初始化 Store → 初始化 5 视图 → 播放/暂停/重置 → 键盘快捷键 (Space/R) |
| 视图 ② | `js/views/timelineView.js` | **时序趋势图**：多系列折线 + dataZoom 刷选 (200ms 节流) → `SET_TIME_RANGE` |
| 视图 ④ | `js/views/policyView.js` | **防控政策时间轴**：散点标记 + 病例背景趋势 + 点击 → `SET_SELECTED_POLICY_IDS` |
| 部署 | GitHub Pages | Settings → Pages → Source: Deploy from branch → main → /root |
| 版本控制 | `.gitignore` | Python/OS/IDE/Claude 忽略规则 |

**视图职责细节**：

- **时序图**：dataZoom 是**唯一时间过滤器**（已移除标题栏冗余滑块）→ 刷选时 dispatch `SET_TIME_RANGE` → 其他 4 视图响应；高亮区域用粗线（width 3.5 vs 1.5）
- **政策轴**：5 种政策类型 (lockdown/vaccination/aid/surveillance/health_response) → 按 POLICY 配色 → 点击散点 dispatch `SET_SELECTED_POLICY_IDS` → 热力图添加垂直 markLine

**技能要求**：HTML/CSS 布局、ECharts 配置、Git/GitHub Pages、DOM 事件

---

### 协作接口（两人都需要了解）

| 接口 | 说明 | 涉及双方 |
|------|------|:--------:|
| Store 订阅 | B 提供 `store.subscribe(render)` — C 的视图中调用 | B → C |
| Action dispatch | B 定义 action — C 的视图用户交互时调用 | B → C |
| `dataLoader.js` | B 提供 `filterCases()` / `summarizeBy*()` — 所有人使用 | B → A,C |
| 视图接口 | 所有视图 export `init(dom, store, data)` → `{ render, resize, destroy }` | B,C |
| `window.__store` / `__data` | B 在 main.js 挂载 (C) → A 在 Console 验证数据 | C → A |

---

## 💻 开发流程

### 添加新视图（模板）

```javascript
// js/views/myView.js — 最小视图模板
import { someAction } from '../actions.js';

export function initMyView(dom, store, data) {
  const chart = echarts.init(dom);

  function render(state) {
    chart.setOption({ /* ECharts option based on store state */ });
  }

  chart.on('click', (params) => {
    store.dispatch(someAction(params.name));
  });

  const unsub = store.subscribe(render);
  render(store.getState());

  return {
    render,
    resize: () => chart.resize(),
    destroy: () => { unsub(); chart.dispose(); },
  };
}
```

添加步骤：
1. 在 `js/views/` 创建 `newView.js`，导出 `init(dom, store, data)`
2. 在 `index.html` 添加容器 `<div id="chart-new"></div>`
3. 在 `css/style.css` 添加 `grid-area: new;`
4. 在 `js/main.js` 导入并初始化

### 更新疫情数据（每周 WHO SitRep 发布后）

```bash
conda activate EBOLAVIZ
# 编辑 scripts/build_real_data.py，在 build_cases() 中添加新周报数据行
python3 scripts/build_real_data.py
# 重启开发服务器生效
```

### 提交前自动化冒烟测试

**每次提交前必须通过：** 这条测试能捕获 `buildOption is not defined` 之类的运行时错误，无需打开浏览器。

```bash
node tests/smoke.test.js
# 期望输出: ✅ All 5 views initialized and destroyed successfully
```

如果测试失败（exit code ≠ 0），说明某个视图 `init()` 抛出了异常——先修再提交。

### 代码质量检查清单

| 检查项 | 标准 |
|--------|------|
| 冒烟测试 | `node tests/smoke.test.js` 是否全部通过？ |
| 视图接口 | 是否导出 `init(dom, store, data)` → `{ render, resize, destroy }`？ |
| 数据流 | 是否从 `state` 读取筛选条件，而非视图内部缓存状态？ |
| Store 交互 | 用户交互是否走 `store.dispatch(action)`，而非直接修改 DOM？ |
| 清理 | `destroy()` 中是否调用了 `unsub()` 和 `chart.dispose()`？ |
| 边界情况 | 数据为空/null 时视图是否优雅降级（不报错、不崩溃）？ |
| 纯函数 | `reducer` 是否不修改原 state（使用 `{ ...state }` 展开）？ |

### 分支和提交规范

1. **分支命名**：`feat/<功能>` 或 `fix/<问题>`
2. **提交消息**：遵循 conventional commits
   - `feat: add GeoJSON choropleth support`
   - `fix: prevent dataZoom dispatch loop`
   - `docs: add case study`
3. **提交前检查**：`node tests/smoke.test.js` 通过 + 开发服务器正常启动 + 所有视图无 Console 报错 + 联动不受影响

---

## 🧪 测试指南

本系统为可视化交互系统，测试以**手动验证**为主。以下按角色和整体划分。

---

### 🅰 A 角色测试（数据 + 文档）

> 在终端中运行，不需要启动浏览器。

**测试 A1：数据生成无报错**

```bash
conda activate EBOLAVIZ
python3 scripts/build_real_data.py
# ✅ 期望：无 ImportError、无 FileNotFoundError、无异常退出
```

**测试 A2：数据记录数达标**

```bash
python3 -c "
import json
checks = [
    ('cases_by_region_date', 15),   # 至少 15 条病例记录
    ('demographics',          12),   # 至少 12 个区域
    ('policy_events',         16),   # 至少 16 条政策事件
]
for fname, min_count in checks:
    data = json.load(open(f'data/{fname}.json'))
    ok = len(data) >= min_count
    print(f'  {\"✅\" if ok else \"❌\"} {fname}: {len(data)} records (need ≥{min_count})')
"
```

**测试 A3：GeoJSON 合并可用**

```bash
python3 scripts/merge_geojson.py
python3 -c "
import json
geo = json.load(open('data/geo/outbreak_region.geojson'))
feats = len(geo['features'])
# Must contain DRC (26 provinces) + Uganda (4 regions) = 30 features
print(f'  {\"✅\" if feats==30 else \"❌\"} outbreak_region.geojson: {feats} features (need 30)')
# Verify key affected provinces exist
names = [f['properties']['name'] for f in geo['features']]
for n in ['Ituri', 'Nord-Kivu', 'Western Region', 'Central Region']:
    print(f'  {\"✅\" if n in names else \"❌\"} Province \"{n}\" in GeoJSON')
"
```

**测试 A4：中期文档可导出 PDF（可选）**

```bash
conda activate EBOLAVIZ
python3 -c "
import markdown2, weasyprint; from pathlib import Path
md = Path('docs/中期文档.md').read_text()
css = 'body{font-family:serif;font-size:12pt;line-height:1.8;max-width:800px;margin:40px auto}'
html = f'<html><meta charset=utf-8><style>{css}</style><body>{markdown2.markdown(md, extras=[\"tables\",\"fenced-code-blocks\"])}</body></html>'
weasyprint.HTML(string=html).write_pdf('docs/中期文档.pdf')
print('✅ PDF generated:', Path('docs/中期文档.pdf').stat().st_size // 1024, 'KB')
"
```

---

### 🅱 B 角色测试（可视化 + 交互核心）

> 需启动开发服务器后在浏览器 Console 中运行。

**测试 B1：Store + Actions 纯函数**

```javascript
// 浏览器 Console，打开 http://localhost:<端口>
const store = window.__store;

// 1) reducer 返回新对象（不修改原 state）
const s1 = store.getState();
store.dispatch({ type: 'SET_IS_PLAYING', payload: true });
const s2 = store.getState();
console.assert(s1 !== s2,                    '✅ 1/6 Store returns new object');
console.assert(s1.isPlaying === false,       '✅ 2/6 isPlaying default false');
console.assert(s2.isPlaying === true,        '✅ 3/6 SET_IS_PLAYING works');

// 2) SET_TIME_RANGE
store.dispatch({ type: 'SET_TIME_RANGE', payload: ['2026-05-20', '2026-05-25'] });
console.assert(store.getState().timeRange[0] === '2026-05-20', '✅ 4/6 SET_TIME_RANGE');

// 3) RESET_ALL clears everything
store.dispatch({ type: 'SET_SELECTED_REGIONS', payload: ['Mongbalu'] });
store.dispatch({ type: 'RESET_ALL', payload: { timeRange: ['2026-05-01','2026-05-31'] } });
const s3 = store.getState();
console.assert(s3.isPlaying === false,       '✅ 5/6 RESET clears isPlaying');
console.assert(s3.selectedRegions.length===0, '✅ 6/6 RESET clears selectedRegions');
console.log('✅ All Store tests passed');
```

**测试 B2：dataLoader 边界情况**

```javascript
const { filterCases, summarizeByRegion, summarizeByProvince } =
  await import('./js/utils/dataLoader.js');

// null/undefined inputs
console.assert(filterCases(null, {}).length === 0,        '✅ 1/5 null cases');
console.assert(filterCases([], {}).length === 0,          '✅ 2/5 empty cases');

// Aggregation
const sample = [
  {region:'A',country:'COD',province:'X',new_cases:5,new_deaths:1,suspected_cases:10,suspected_deaths:2,date:'2026-05-18'},
  {region:'A',country:'COD',province:'X',new_cases:3,new_deaths:0,suspected_cases:8,suspected_deaths:1,date:'2026-05-24'},
];
const r = summarizeByRegion(sample);
console.assert(r['A'].totalConfirmed === 8,               '✅ 3/5 summarizeByRegion total');
console.assert(r['A'].totalDeaths === 1,                  '✅ 4/5 summarizeByRegion deaths');

const p = summarizeByProvince(sample);
console.assert(p['X'].totalConfirmed === 8,               '✅ 5/5 summarizeByProvince');
console.log('✅ All dataLoader tests passed');
```

**测试 B3：视图正确渲染**

打开 `http://localhost:<端口>`，在 Console 验证：

```javascript
// 三个 B 角色的视图都应正确初始化
console.assert(!!document.getElementById('chart-heatmap').innerHTML,  '✅ heatmapView');
console.assert(!!document.getElementById('chart-parallel').innerHTML,  '✅ parallelView');
console.assert(!!document.getElementById('chart-detail').innerHTML,    '✅ detailView');
// 热力图应使用 choropleth 模式（GeoJSON 存在时）
const store = window.__store;
store.subscribe(s => console.log('State updated:', s));
```

**测试 B4：热力图 Choropleth 模式**

1. 打开 `http://localhost:<端口>`
2. 确认热力图显示的是**彩色填充地图**（不是散点气泡），说明 GeoJSON 加载成功
3. 点击 "Ituri" 省份 → 省份高亮变色，其他视图联动
4. 悬浮 "Nord-Kivu" → 省份边框加粗 + 阴影

---

### 🅲 C 角色测试（前端 + 部署）

> 需启动开发服务器后在浏览器中验证。

**测试 C1：页面骨架加载**

```javascript
// 浏览器 Console
// 1) 标题栏按钮存在
console.assert(!!document.getElementById('btn-play'),   '✅ Play button');
console.assert(!!document.getElementById('btn-pause'),  '✅ Pause button');
console.assert(!!document.getElementById('btn-reset'),  '✅ Reset button');

// 2) 五个视图容器存在
['chart-heatmap','chart-timeline','chart-parallel','chart-policy','chart-detail']
  .forEach(id => console.assert(!!document.getElementById(id), `✅ Container #${id}`));

// 3) ECharts 已加载
console.assert(typeof echarts !== 'undefined', '✅ ECharts loaded');
```

**测试 C2：播放控制 + 键盘快捷键**

| # | 操作 | 期望 | 通过 |
|---|------|------|:----:|
| C2-1 | 点击 **▶ 播放** | 日期逐帧更新 (800ms/帧)；按钮变灰 | ☐ |
| C2-2 | 点击 **⏸ 暂停** | 动画停止；停留在当前日期 | ☐ |
| C2-3 | 点击 **↺ 重置** | 所有筛选清除；全视图恢复初始 | ☐ |
| C2-4 | 按 `Space` | 等效于点击播放/暂停按钮 | ☐ |
| C2-5 | 按 `R` | 等效于点击重置按钮 | ☐ |
| C2-6 | `Ctrl+R` 在输入框中 | 应正常输入字符，**不**触发重置 | ☐ |

**测试 C3：时序图 (timelineView)**

| # | 操作 | 期望 | 通过 |
|---|------|------|:----:|
| C3-1 | 查看初始状态 | 多条曲线（每区域一条），有 dataZoom 滑块 | ☐ |
| C3-2 | 拖动 dataZoom 滑块 | 热力图/平行坐标/详情联动更新 | ☐ |
| C3-3 | 悬浮高亮区域（从热力图触发） | 对应曲线变粗 (lineWidth 3.5) | ☐ |

**测试 C4：政策轴 (policyView)**

| # | 操作 | 期望 | 通过 |
|---|------|------|:----:|
| C4-1 | 查看初始状态 | 散点标记 + 病例趋势背景线 | ☐ |
| C4-2 | 5 种政策类型 | 颜色不同 (lockdown红/vaccination绿/aid蓝/surveillance橙/health_response紫) | ☐ |
| C4-3 | 点击一个散点 | 选中高亮；热力图添加垂直 markLine | ☐ |

**测试 C5：CSS Grid 响应式布局**

| # | 操作 | 期望 | 通过 |
|---|------|------|:----:|
| C5-1 | 查看初始布局 | 5 视图按 Grid 排列，无重叠空白 | ☐ |
| C5-2 | 调整窗口宽度 → 窄 (≤900px) | 布局切换为单列，所有视图可见 | ☐ |
| C5-3 | 调整窗口高度 | 视图高度比例保持，无溢出 | ☐ |

---

### 🔗 整体集成测试（三人共同验收）

> 所有组员部署同一版本后，在浏览器中逐项验证。**这是答辩前必须全通过的项目。**

| # | 操作 | 期望联动效果 | 涉及视图 | 通过 |
|---|------|-------------|:------:|:----:|
| I1 | 热力图 **点击** Ituri 省 | 时序图仅显示 Ituri 下 4 个卫生区曲线；详情面板更新 | ①②⑤ | ☐ |
| I2 | 热力图 **再次点击** Ituri 省 | 取消选中，所有区域恢复显示 | ①②⑤ | ☐ |
| I3 | 时序图 dataZoom **刷选** 5/18-5/24 | 热力图数据聚合到该时段；平行坐标过滤；详情更新 | ①②③⑤ | ☐ |
| I4 | 热力图 **悬浮** Nord-Kivu | 时序图对应曲线加粗 → 鼠标移出恢复 | ①② | ☐ |
| I5 | 按 `Space` 开始播放 | 所有视图逐日期更新；日期显示更新；5 帧后暂停正常 | ①②③④⑤ | ☐ |
| I6 | 按 `R` 重置 | 所有筛选清除；全部视图恢复初始状态 | ①②③④⑤ | ☐ |
| I7 | 平行坐标 **brush 刷选** 高死亡率区域 | 热力图仅显示对应省份；时序图过滤；详情更新 | ①②③⑤ | ☐ |
| I8 | 政策轴 **点击** P001 (首个响应) | 热力图添加 markLine；详情面板显示政策 | ①④⑤ | ☐ |
| I9 | 选中 0 个区域 | 全部数据正常显示 (不报错不崩溃) | 全部 | ☐ |
| I10 | 连续快速点击（压力测试） | 无卡顿、无报错、无状态不一致 | 全部 | ☐ |
| I11 | 调整浏览器窗口大小 | 所有视图自适应缩放，无重叠空白 | 全部 | ☐ |

---

### 🐛 调试

```javascript
// 浏览器 Console 中可用的调试接口:
window.__store.getState()   // 查看当前全局状态
window.__store.dispatch({    // 手动触发筛选
  type: 'SET_SELECTED_REGIONS',
  payload: ['Mongbalu', 'Bunia']
})
window.__data                // 查看全部加载的数据
window.__data.ugaDistrictRegion  // 乌干达 district→大区 映射
```

---

## 📖 常见任务

### 更新疫情数据

```bash
conda activate EBOLAVIZ
# 1. 编辑 scripts/build_real_data.py 的 build_cases() 列表
# 2. 重新生成
python3 scripts/build_real_data.py
# 3. 提交
git add data/
git commit -m "feat: add WHO SitRep 03 data (2026-05-31)"
```

### 导出文档为 PDF

```bash
conda activate EBOLAVIZ
python3 -c "
import markdown2, weasyprint
from pathlib import Path
md = Path('docs/中期文档.md').read_text()
css = 'body{font-family:serif;font-size:12pt;line-height:1.8;max-width:800px;margin:40px auto} h2{border-bottom:2px solid #333;padding-bottom:4px;margin-top:24px} h1{font-size:18pt;text-align:center} table{border-collapse:collapse;width:100%;margin:12px 0} th,td{border:1px solid #ccc;padding:6px 10px} th{background:#f0f0f0} code{background:#f5f5f5;padding:1px 4px} pre{background:#f5f5f5;padding:12px;font-size:9pt}'
html = f'<html><meta charset=utf-8><style>{css}</style><body>{markdown2.markdown(md, extras=[\"tables\",\"fenced-code-blocks\"])}</body></html>'
weasyprint.HTML(string=html).write_pdf(str(md_path.with_suffix('.pdf')))
print('✅ PDF generated')
"
```

### 录制 Demo 视频（3~5 分钟）

建议流程：
1. 全景展示五视图布局
2. 在地图上选中高风险区域 → 展示多视图联动
3. dataZoom 刷选疫情高峰期 → 展示时空联动
4. 按 `Space` 播放时间动画 → 展示疫情扩散
5. 平行坐标刷选高死亡率样本 → 展示多因素关联
6. 点击政策轴 "边境关闭" 节点 → 展示政策前后对比

---

## ⌨ 快捷键

| 键 | 功能 |
|----|------|
| `Space` | 播放/暂停时间动画 |
| `R` | 重置所有筛选 |

---

## 🤖 AI 使用声明

本系统开发使用了 Claude (Anthropic) 辅助系统架构设计、Store 结构设计、数据策略制定；使用了 GitHub Copilot 辅助前端代码补全和 ECharts 配置调试。核心设计决策（联动矩阵、状态分离、三层数据策略、dataZoom 作为唯一时间过滤器）均由团队独立做出，可在答辩中清晰解释。

---

## 📄 许可

代码: MIT | 数据: CC BY 4.0（各数据源）
