# EbolaViz2026 — 2026 年埃博拉疫情时空可视化分析系统

> 数据可视化导论课程大作业 | 3 人团队 | 2026 Spring

---

## 快速开始

```bash
git clone https://github.com/youarer1ght/EbolaViz2026.git
cd EbolaViz2026
python3 -m http.server 8080 -b localhost
# 浏览器打开 http://localhost:8080
```

> 看到 5 视图网格布局 + Console 输出 `✅ EbolaViz2026 ready.` 即成功。
> 端口被占用时换一个即可（如 `8888`、`3000`）。

### 备选：npx serve

如果机器上没有 Python 3，或者希望自动处理 CORS / SPA fallback / 端口冲突：

```bash
npx serve . -p 8080
# 浏览器打开 http://localhost:8080
```

| | `python3 -m http.server` | `npx serve .` |
|---|---|---|
| 依赖 | Python 3（系统自带） | Node.js + npm（自动下载 `serve`） |
| 首次启动 | 即时 | 需联网下载 `serve` 包（~2 MB），后续使用缓存即时 |
| 端口指定 | `8080 -b localhost` | `-p 8080`，默认绑定 `localhost` |
| CORS 头 | 无 | 默认带 CORS 头（可跨域调试） |
| SPA fallback | 无（手动输入完整路径） | 自动将未知路径重定向到 `index.html` |
| 目录列表 | 显示文件列表 | 默认显示文件列表，`-s` 启用 SPA 模式 |
| 适用场景 | 快速预览，零配置 | 模拟静态部署环境（更接近 GitHub Pages） |

`-b localhost` 确保终端输出 `http://localhost:8080` 而非无法点击的 `http://0.0.0.0:8080`。如果 Python 版本较旧不支持 `-b`，忽略即可，手动在浏览器输入 `localhost:8080`。

---

## 📖 文档导航

### 按阅读目的查找

| 我想… | 看这个 |
|-------|--------|
| 快速启动项目 | `README.md`（本文件）→ 快速开始 |
| 了解开发命令和架构 | [CLAUDE.md](CLAUDE.md) — 启动命令、数据流、视图接口规范 |
| 理解设计原理和技术细节 | [docs/系统文档.md](docs/系统文档.md) — 分析任务、视图设计、协调机制、案例展示、SEIR 外推方法、维护指南 |
| 查看各成员负责什么 | [docs/分工说明.md](docs/分工说明.md) — A/B/C 角色职责 + 具体文件列表 |
| 看中期报告（历史快照） | [docs/中期文档.md](docs/中期文档.md) — 七章中期报告，记录项目开发中段状态 |

### 按角色查找

| 角色 | 必读 |
|------|------|
| **助教**（运行系统） | README 快速开始 + [CLAUDE.md](CLAUDE.md) 命令 |
| **助教**（评审作业） | [docs/系统文档.md](docs/系统文档.md) + [docs/分工说明.md](docs/分工说明.md) |
| **开发者**（接手维护） | [CLAUDE.md](CLAUDE.md) + [docs/系统文档.md §第五章](docs/系统文档.md#第五章-后续维护指南) |
| **答辩评委** | [docs/系统文档.md §第三章](docs/系统文档.md#第三章-案例展示-case-study) 案例展示 + [§2.4](docs/系统文档.md#24-关键设计决策) 设计决策 |

### 提交作业需要的文档

| 文档 | 作用 |
|------|------|
| [docs/系统文档.md](docs/系统文档.md) | ⭐ 核心提交文档：设计需求、系统架构、案例展示、AI 声明 |
| [docs/中期文档.md](docs/中期文档.md) | 中期阶段报告（可作为附录提交） |
| [docs/分工说明.md](docs/分工说明.md) | 团队分工与贡献度说明 |

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
│   │   ├── heatmapView.js            # ① 时空热力图（单 Series choropleth + 分栏 + 卫生区散点）
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
│   ├── unit.test.js                  # 95 断言 — Store/Actions/Colors/DataLoader/stateKeysEqual 纯逻辑
│   ├── data.test.js                  # 602 断言 — JSON 字段/交叉校验/GeoJSON 结构
│   ├── option.test.js                # 78 断言 — 5 视图 init→render→reset→destroy 合约
│   ├── coordination.test.js          # 33 断言 — 联动事件链验证
│   └── smoke.test.js                 # 5 断言 — Mock ECharts + DOM 冒烟
└── docs/
    ├── 系统文档.md / .pdf
    ├── 中期文档.md / .pdf
    └── 分工说明.md
```

---

## 命令速查

```bash
# 开发服务器（任选其一）
python3 -m http.server 8080 -b localhost
npx serve . -p 8080                     # 备选：自动 CORS + SPA fallback

# 数据处理（需 conda activate EBOLAVIZ）
python3 scripts/build_real_data.py      # CSV → JSON
python3 scripts/extrapolate_cases.py    # 时间序列外推

# 测试（共 5 套，885 断言）
node tests/unit.test.js               # 95 — 纯逻辑：Store + Actions + Colors + DataLoader + stateKeysEqual
node tests/data.test.js               # 674 — 数据完整性 + 政策事件校验
node tests/option.test.js             # 78 — 视图合约
node tests/coordination.test.js       # 33 — 联动事件链
node tests/smoke.test.js              # 5 — 冒烟

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

开发使用了 Claude (Anthropic) 辅助架构设计、ECharts 配置调试、数据管线重构；GitHub Copilot 辅助前端代码补全。详见 [docs/系统文档.md §第四章](docs/系统文档.md#第四章-ai-使用声明)。
