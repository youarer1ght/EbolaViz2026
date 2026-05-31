# EbolaViz2026 — 2026 年埃博拉疫情时空可视化分析系统

> 数据可视化导论课程大作业 | 3 人团队 | 2026 Spring

---

## 快速开始

```bash
git clone https://github.com/youarer1ght/EbolaViz2026.git
cd EbolaViz2026
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

> 看到 5 视图网格布局 + Console 输出 `✅ EbolaViz2026 ready.` 即成功。
> 端口被占用时换一个即可（如 `8888`、`3000`），也可以用 `npx serve .`。

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [CLAUDE.md](CLAUDE.md) | 开发命令、项目架构、数据流、视图接口规范 |
| [docs/系统文档.md](docs/系统文档.md) | 设计需求、5 视图设计、协调机制、关键决策、案例展示、数据外推方法、AI 声明 |
| [docs/分工说明.md](docs/分工说明.md) | A/B/C 角色职责划分 |
| [docs/中期文档.md](docs/中期文档.md) | 中期报告（7 章） |

---

## 项目结构

```
EbolaViz2026/
├── index.html                         # SPA 入口
├── css/style.css                      # CSS Grid 布局
├── js/
│   ├── main.js                        # 入口：加载数据 → Store → 5 视图 → 播放/键盘
│   ├── store.js                       # createStore() + reducer (~75行)
│   ├── actions.js                     # Action creators
│   ├── views/
│   │   ├── heatmapView.js            # ① 时空热力图（双 Series 边框叠加 + 分栏 + 卫生区散点）
│   │   ├── timelineView.js           # ② 时序趋势图 + dataZoom
│   │   ├── parallelView.js           # ③ 平行坐标图（多因素关联）
│   │   ├── policyView.js             # ④ 防控政策时间轴
│   │   └── detailView.js             # ⑤ 统计详情面板
│   └── utils/
│       ├── dataLoader.js             # 数据加载 + filter/aggregate
│       └── colors.js                 # 配色方案
├── data/
│   ├── cases.csv / *.json            # 病例数据（CSV 可编辑，JSON 由脚本生成）
│   ├── demographics.csv / *.json     # 人口/医疗数据
│   ├── policy_events.csv / *.json    # 政策事件
│   ├── border_poe.csv / *.json       # 边境口岸
│   └── geo/                          # ADM1 GeoJSON（DRC 26 省 + Uganda 4 区）
├── scripts/
│   ├── build_real_data.py            # CSV → JSON + 数据校验
│   ├── extrapolate_cases.py          # SEIR + 重力模型数据外推
│   └── merge_geojson.py              # 合并 DRC+UGA GeoJSON
├── tests/
│   └── smoke.test.js                 # 冒烟测试：5 视图 init/destroy
└── docs/
    ├── 系统文档.md / .pdf
    ├── 中期文档.md / .pdf
    └── 分工说明.md
```

---

## 命令速查

```bash
# 开发服务器
python3 -m http.server 8080

# 数据处理（需 conda activate EBOLAVIZ）
python3 scripts/build_real_data.py      # CSV → JSON
python3 scripts/extrapolate_cases.py    # 时间序列外推

# 冒烟测试
node tests/smoke.test.js

# 推送
git push origin main
```

---

## ⌨ 快捷键

| 键 | 功能 |
|----|------|
| `Space` | 播放/暂停时间动画 |
| `R` | 重置所有筛选 |

---

## 📄 许可

代码: MIT | 数据: CC BY 4.0（WHO AFRO / WorldPop / healthsites.io / FAO LCCS / geoBoundaries / ReliefWeb）

## 🤖 AI 使用声明

开发使用了 Claude (Anthropic) 辅助架构设计、ECharts 配置调试、数据管线重构；GitHub Copilot 辅助前端代码补全。详见 [docs/系统文档.md §第四章](docs/系统文档.md)。
