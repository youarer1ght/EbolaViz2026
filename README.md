# EbolaViz2026 — 2026 年埃博拉疫情时空可视化分析系统

> 数据可视化导论课程大作业 | 3 人团队 | 2026 Spring

---

## 📋 前置要求

- **Python 3.8+**（用于数据处理脚本与本地开发服务器）
- **现代浏览器**（Chrome / Edge / Firefox，需支持 ES Modules）
- **Git**（版本控制）
- （可选）**Conda**（用于 `EBOLAVIZ` 独立 Python 环境）

---

## 🚀 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/youarer1ght/EbolaViz2026.git
cd EbolaViz2026
```

### 2. 预处理数据（可选，仓库已包含预处理后的数据）

```bash
# 使用 Conda 环境（推荐）
conda activate EBOLAVIZ
python3 scripts/build_real_data.py

# 或使用 mock 数据（无需 conda 环境）
python3 scripts/generate_mock_data.py
```

### 3. 启动开发服务器

```bash
# 方式一：Python 内置服务器（推荐，零依赖）
python3 -m http.server 8080

# 方式二：npx（需 Node.js）
npx serve .

# 浏览器打开 http://localhost:8080
```

**助教 15 分钟搭建指南**: 无需安装任何依赖，只需 Python 3 内置模块即可运行。仓库已包含预处理后的数据文件，克隆后可直接启动。

---

## 🏗 系统架构

```
展示层:  5 个 ECharts 视图 (heatmap, timeline, parallel, policy, detail)
事件层:  用户交互 → dispatch(action)
状态层:  全局 Store (手写 ~50 行观察者模式)
数据层:  静态 JSON 文件 (WHO AFRO SitReps, World Bank, ReliefWeb)
```

### 项目结构

```
EbolaViz2026/
├── index.html              # SPA 入口
├── css/
│   └── style.css           # CSS Grid 五视图布局
├── js/
│   ├── main.js             # 入口: 加载数据 → 初始化 Store → 注册视图 → 播放控制
│   ├── store.js            # createStore() + reducer (全局状态管理, ~75行)
│   ├── actions.js          # 9 个 action creator 函数
│   ├── views/              # 五个视图模块
│   │   ├── heatmapView.js  # ① 时空热力图 (scatter/choropleth)
│   │   ├── timelineView.js # ② 时序趋势图 + dataZoom
│   │   ├── parallelView.js # ③ 平行坐标图 (多因素关联)
│   │   ├── policyView.js   # ④ 防控政策时间轴
│   │   └── detailView.js   # ⑤ 统计详情面板
│   └── utils/
│       ├── dataLoader.js   # 数据加载 + 过滤/聚合工具
│       └── colors.js       # 配色方案 (HEATMAP, TABLEAU, POLICY)
├── data/                   # 预处理后的静态数据 (CC BY 4.0)
│   ├── cases_by_region_date.json
│   ├── demographics.json
│   ├── policy_events.json
│   ├── border_poe.json
│   └── geo/                # 行政区划 GeoJSON (待添加)
├── scripts/                # Python 数据处理脚本
│   ├── build_real_data.py  # 真实数据构建 (WHO/World Bank/ReliefWeb)
│   ├── generate_mock_data.py  # Mock 数据生成 (开发 fallback)
│   └── requirements.txt
└── docs/                   # 文档
    ├── 中期文档.md / .pdf
    ├── 系统文档.md
    └── 分工说明.md
```

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
    store.dispatch(someAction(params.name));  // 用户交互 → dispatch
  });

  const unsub = store.subscribe(render);      // Store → 自动重绘
  render(store.getState());                   // 初始渲染

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

### 更新疫情数据

```bash
# 编辑 scripts/build_real_data.py，在 build_cases() 列表中添加新周报数据
# 数据格式:
# {"date":"2026-05-31","region":"Mongbalu","suspected_cases":...}
python3 scripts/build_real_data.py
# 重启开发服务器生效
```

### 代码质量检查清单

本项目为纯前端项目，手动审查以下要点：

| 检查项 | 标准 |
|--------|------|
| 视图接口 | 是否导出 `init(dom, store, data)` → `{ render, resize, destroy }`？ |
| 数据流 | 是否从 `state` 读取筛选条件，而非视图内部缓存状态？ |
| Store 交互 | 用户交互是否走 `store.dispatch(action)`，而非直接修改 DOM？ |
| 清理 | `destroy()` 中是否调用了 `unsub()` 和 `chart.dispose()`？ |
| 边界情况 | 数据为空/null 时视图是否优雅降级（不报错、不崩溃）？ |
| 纯函数 | `reducer` 是否不修改原 state（使用 `{ ...state }` 展开）？ |

### 分支和提交规范

1. **分支命名**：`feat/<功能>` 或 `fix/<问题>`
   - ✅ `feat/add-choropleth-map`
   - ✅ `fix/timeline-datazoom-sync`

2. **提交消息**：遵循 conventional commits
   - `feat: add GeoJSON choropleth support to heatmap`
   - `fix: prevent dataZoom dispatch loop in timeline`
   - `docs: add case study to system doc`
   - `refactor: extract color scales to utils/colors.js`

3. **提交前检查**：
   - 开发服务器正常启动
   - 所有视图渲染无 Console 报错
   - 联动功能不受影响

---

## 🧪 测试指南

本系统为可视化交互系统，测试以**手动验证**为主。

### 数据完整性测试

```bash
# 1. 数据生成无错误
python3 scripts/build_real_data.py

# 2. 验证数据记录数
python3 -c "
import json
for f in ['cases_by_region_date','demographics','policy_events']:
    data = json.load(open(f'data/{f}.json'))
    print(f'{f}: {len(data)} records')
"
# 期望: cases: 15+, demographics: 12, policy_events: 16
```

### 视图渲染测试

打开 `http://localhost:8080`：
- 浏览器 Console 无红色报错
- 看到 `✅ EbolaViz2026 ready.` 日志
- 五个视图容器均显示内容（非空白）

### 联动功能测试矩阵

| # | 操作 | 期望结果 |
|---|------|----------|
| 1 | 热力图 **点击**区域 | 时序图仅显示该区域曲线；详情面板更新统计 |
| 2 | 时序图 **dataZoom 刷选**时间段 | 热力图数据更新；政策轴过滤；平行坐标过滤 |
| 3 | 热力图 **悬浮**区域 | 时序图对应曲线加粗（不触发全局数据过滤） |
| 4 | 按 `Space` 播放 | 热力图日期逐帧推进；日期显示更新 |
| 5 | 按 `R` 重置 | 所有筛选清除；全部视图恢复初始状态 |
| 6 | 政策轴 **点击**事件节点 | 详情面板显示政策信息 |
| 7 | 调整浏览器窗口大小 | 所有视图自适应缩放，无重叠或空白 |

### Store 单元测试（浏览器 Console）

```javascript
// 打开 http://localhost:8080，在 Console 中执行
const store = window.__store;

// 测试 1: reducer 是纯函数
const s1 = store.getState();
store.dispatch({ type: 'SET_IS_PLAYING', payload: true });
const s2 = store.getState();
console.assert(s1.isPlaying === false && s2.isPlaying === true,
  '✅ SET_IS_PLAYING works');

// 测试 2: RESET_ALL
store.dispatch({ type: 'RESET_ALL', payload: { timeRange: ['2026-05-01','2026-05-31'] } });
const s3 = store.getState();
console.assert(s3.isPlaying === false && s3.selectedRegions.length === 0,
  '✅ RESET_ALL works');

// 测试 3: dataLoader 边界情况
const { filterCases, aggregateByRegion } =
  await import('./js/utils/dataLoader.js');
console.assert(filterCases(null, {}).length === 0,
  '✅ filterCases handles null');
console.assert(filterCases([], {}).length === 0,
  '✅ filterCases handles empty');
console.assert(Object.keys(aggregateByRegion([])).length === 0,
  '✅ aggregateByRegion handles empty');

console.log('✅ All Store and dataLoader tests passed');
```

### 调试

```javascript
// 浏览器 Console 中可用:
window.__store.getState()   // 查看当前全局状态
window.__store.dispatch({    // 手动触发筛选
  type: 'SET_SELECTED_REGIONS',
  payload: ['Goma', 'Bunia']
})
window.__data                // 查看全部加载的数据
```

---

## 📖 常见任务

### 更新疫情数据（每周 WHO SitRep 发布后）

```bash
# 1. 编辑 scripts/build_real_data.py，在 build_cases() 中添加新周报数据行
# 2. 重新生成
python3 scripts/build_real_data.py
# 3. 提交
git add data/cases_by_region_date.json
git commit -m "feat: add WHO SitRep 03 data (2026-05-31)"
```

### 导出中期/系统文档为 PDF

```bash
conda activate EBOLAVIZ
python3 -c "
import markdown2, weasyprint
from pathlib import Path
md_path = Path('docs/中期文档.md')
md = md_path.read_text()
css = 'body{font-family:serif;font-size:12pt;line-height:1.8;max-width:800px;margin:40px auto} h2{border-bottom:2px solid #333;padding-bottom:4px;margin-top:24px} h1{font-size:18pt;text-align:center} table{border-collapse:collapse;width:100%;margin:12px 0} th,td{border:1px solid #ccc;padding:6px 10px} th{background:#f0f0f0} code{background:#f5f5f5;padding:1px 4px;font-size:9pt} pre{background:#f5f5f5;padding:12px;font-size:9pt}'
html = f'<html><meta charset=utf-8><style>{css}</style><body>{markdown2.markdown(md, extras=[\"tables\",\"fenced-code-blocks\"])}</body></html>'
weasyprint.HTML(string=html).write_pdf(str(md_path.with_suffix('.pdf')))
print('✅ PDF generated')
"
```

### 升级热力图为 Choropleth 模式

当获取到 DRC/Uganda 的 GeoJSON 文件后：

1. 将 `DRC.geojson` 和 `UGA.geojson` 放入 `data/geo/`
2. 编辑 `js/views/heatmapView.js`：
   - 取消注释 GeoJSON 注册和 choropleth 渲染代码
   - 将 `buildBubbleOption` 替换为 `buildChoroplethOption` 作为默认
3. 验证热力图从气泡模式切换为区域填充模式

### 录制 Demo 视频（3~5 分钟）

建议流程：
1. 全景展示五视图布局
2. 在地图上选中高风险区域 → 展示多视图联动
3. dataZoom 刷选疫情高峰期 → 展示时空联动
4. 按 `Space` 播放时间动画 → 展示疫情扩散
5. 平行坐标刷选高死亡率样本 → 展示多因素关联
6. 点击政策轴 "边境关闭" 节点 → 展示政策前后对比

---

## 🔐 数据来源

| 数据集 | 来源 | 许可 |
|--------|------|------|
| 病例数据 | [WHO AFRO Weekly SitReps](https://www.afro.who.int/) + [kraemer-lab/Ebola_DRC_2026](https://github.com/kraemer-lab/Ebola_DRC_2026) | WHO Open Access / CC BY 4.0 |
| 人口地理 | [World Bank Open Data](https://data.worldbank.org/) + [HDX](https://data.humdata.org/) | CC BY 4.0 |
| 医疗资源 | [WHO GHO](https://www.who.int/data/gho) + [GRID3](https://data.grid3.org/) | CC BY 4.0 |
| 政策事件 | [WHO DON 605](https://www.who.int/emergencies/disease-outbreak-news) + [ReliefWeb](https://reliefweb.int/) | CC BY 4.0 |
| 边境口岸 | [kraemer-lab/Ebola_DRC_2026](https://github.com/kraemer-lab/Ebola_DRC_2026) (OSM) | ODbL |

---

## 👥 组员分工

| 角色 | 模块 | 文件 |
|:----:|------|------|
| **A 数据+文档** | 数据获取清洗、中期/系统文档、case study | `data/` `scripts/` `docs/` |
| **B 可视化+交互** | 热力图、平行坐标、Store/联动核心、配色 | `js/store.js` `js/views/heatmapView.js` `js/views/parallelView.js` |
| **C 前端+部署** | 时序图、政策轴、布局/样式、GitHub Pages | `index.html` `css/style.css` `js/main.js` `js/views/timelineView.js` `js/views/policyView.js` |

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

代码: MIT | 数据: CC BY 4.0 (各数据源)
