# EbolaViz2026 — 2026 年埃博拉疫情时空可视化分析系统

> 数据可视化导论课程大作业 | 3 人团队 | 2026 Spring

## 快速启动

```bash
git clone https://github.com/youarer1ght/EbolaViz2026.git
cd EbolaViz2026

python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

**助教 15 分钟搭建指南**: 无需安装任何依赖，只需 Python 3 内置模块即可运行。

## 系统架构

```
展示层:  5 个 ECharts 视图 (heatmap, timeline, parallel, policy, detail)
事件层:  用户交互 → dispatch(action)
状态层:  全局 Store (手写 ~50 行观察者模式)
数据层:  静态 JSON 文件 (WHO AFRO SitReps, World Bank, ReliefWeb)
```

## 项目结构

```
├── index.html          # SPA 入口
├── css/style.css       # CSS Grid 五视图布局
├── js/
│   ├── main.js         # 入口: 加载数据 → 初始化 Store → 注册视图 → 播放控制
│   ├── store.js        # createStore() + reducer (全局状态管理)
│   ├── actions.js      # Action creators
│   ├── views/          # 五个视图模块
│   │   ├── heatmapView.js    # ① 时空热力图
│   │   ├── timelineView.js   # ② 时序趋势图 + dataZoom
│   │   ├── parallelView.js   # ③ 平行坐标图 (多因素关联)
│   │   ├── policyView.js     # ④ 防控政策时间轴
│   │   └── detailView.js     # ⑤ 统计详情面板
│   └── utils/
│       ├── dataLoader.js     # 数据加载 + 过滤/聚合工具
│       └── colors.js         # 配色方案
├── data/               # 预处理后的静态数据 (CC BY 4.0)
├── scripts/            # Python 数据处理脚本
└── docs/               # 文档 (中期/系统/分工)
```

## 数据来源

| 数据集 | 来源 | 许可 |
|--------|------|------|
| 病例数据 | [WHO AFRO Weekly SitReps](https://www.afro.who.int/) + [kraemer-lab/Ebola_DRC_2026](https://github.com/kraemer-lab/Ebola_DRC_2026) | WHO Open Access / CC BY 4.0 |
| 人口地理 | [World Bank Open Data](https://data.worldbank.org/) + [HDX](https://data.humdata.org/) | CC BY 4.0 |
| 医疗资源 | [WHO GHO](https://www.who.int/data/gho) + [GRID3](https://data.grid3.org/) | CC BY 4.0 |
| 政策事件 | [WHO DON 605](https://www.who.int/emergencies/disease-outbreak-news) + [ReliefWeb](https://reliefweb.int/) | CC BY 4.0 |
| 边境口岸 | [kraemer-lab/Ebola_DRC_2026](https://github.com/kraemer-lab/Ebola_DRC_2026) (OSM) | ODbL |

## 组员分工

| 角色 | 模块 | 文件 |
|:----:|------|------|
| A 数据+文档 | 数据获取清洗、中期/系统文档、case study | `data/` `scripts/` `docs/` |
| B 可视化+交互 | 热力图、平行坐标、Store/联动核心、配色 | `js/store.js` `js/views/heatmapView.js` `js/views/parallelView.js` |
| C 前端+部署 | 时序图、政策轴、布局/样式、GitHub Pages | `index.html` `css/style.css` `js/main.js` `js/views/timelineView.js` `js/views/policyView.js` |

## 快捷键

| 键 | 功能 |
|----|------|
| `Space` | 播放/暂停时间动画 |
| `R` | 重置所有筛选 |

## AI 使用声明

本系统开发使用了 Claude (Anthropic) 辅助系统架构设计、Store 结构设计、数据策略制定；使用了 GitHub Copilot 辅助前端代码补全和 ECharts 配置调试。核心设计决策（联动矩阵、状态分离、三层数据策略、dataZoom 作为唯一时间过滤器）均由团队独立做出。

## 许可

代码: MIT | 数据: CC BY 4.0 (各数据源)
