/**
 * View ③: Parallel Coordinates — multi-factor correlation analysis.
 *
 * Coordination:
 *   Click on a line → toggle that region's selection → dispatch
 *   SET_SELECTED_REGIONS → heatmap / timeline / detail filter.
 *   Click "✕ 清除" button (top-right) → clear all selections.
 *
 * Visual encoding:
 *   Color = province (categorical, 10-color palette)
 *   Opacity = mortality rate (higher CFR → more opaque)
 *   Width = selection state (thick = selected, thin = unselected)
 *   Selected lines turn gold regardless of province
 */
import { setSelectedRegions } from '../actions.js';
import { filterCases, summarizeByRegion } from '../utils/dataLoader.js';

// Province color palette — distinct hues for visual separation
const PROVINCE_COLORS = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
  '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990',
  '#dcbeff', '#9a6324', '#800000', '#000075', '#aaffc3',
];

export function initParallel(dom, store, data) {

  // ── Build province → color index mapping (stable across renders) ──
  const provColorMap = {};
  let nextColor = 0;
  function getProvinceColor(province) {
    if (!provColorMap[province]) {
      provColorMap[province] = PROVINCE_COLORS[nextColor % PROVINCE_COLORS.length];
      nextColor++;
    }
    return provColorMap[province];
  }

  // ── Build merged rows: one per region, all 5 dimensions ──
  function buildMerged(cases) {
    const summary = summarizeByRegion(cases);
    return Object.values(summary)
      .filter(s => s.totalConfirmed > 0)
      .map(s => {
        const demo = (data.demographics || []).find(d => d.region === s.region) || {};
        const mortality = s.totalConfirmed > 0
          ? parseFloat((s.totalDeaths / s.totalConfirmed * 100).toFixed(1))
          : 0;
        return {
          region: s.region,
          province: demo.province || s.region,
          values: [
            demo.population_density || 0,
            demo.doctors_per_100k || 0,
            s.totalConfirmed,
            mortality,
            demo.beds_per_10k || 0,
          ],
        };
      });
  }

  /** Opacity from mortality: higher CFR → more visible (0.25–0.90). */
  function mortalityOpacity(cfr) {
    return 0.25 + 0.65 * Math.min(1, cfr / 25);
  }

  /** Selection-aware style:
   *   Selected  → gold, thick, fully opaque
   *   Unselected → province color, thin, opacity from mortality */
  function lineStyle(row, selectedSet) {
    if (selectedSet.has(row.region)) {
      return { color: '#ff8f00', width: 3.5, opacity: 1 };
    }
    const provColor = getProvinceColor(row.province);
    return { color: provColor, width: 1, opacity: mortalityOpacity(row.values[3]) };
  }

  // ── Init ──
  const chart = echarts.init(dom);

  function buildOption(state) {
    // Filter by time range only (not by selectedRegions) so all zones
    // remain visible but reflect the current time window from dataZoom.
    const timeFiltered = filterCases(data.cases, {
      ...state, selectedRegions: [], highlightedRegions: [],
    });
    const merged = buildMerged(timeFiltered);
    const selectedSet = new Set(state.selectedRegions);

    // Per-axis max
    const maxValues = [0, 0, 0, 0, 0];
    for (const row of merged) {
      for (let i = 0; i < 5; i++) {
        if (row.values[i] > maxValues[i]) maxValues[i] = row.values[i];
      }
    }

    return {
      backgroundColor: '#f5f7fa',
      tooltip: {
        trigger: 'item',
        confine: true,
        extraCssText: 'z-index:99999 !important;pointer-events:none;',
        formatter: p => {
          if (!p || !p.name) return '';
          const row = merged.find(r => r.region === p.name);
          if (!row) return '';
          const v = row.values;
          const prov = row.province || '';
          return `<b>${p.name}</b> <span style="color:#888;font-size:0.85em;">${prov}</span><br/>
            人口密度: ${v[0]} 人/km²<br/>
            医生: ${v[1]} 人/10万<br/>
            确诊: ${v[2]} 例<br/>
            死亡率: ${v[3]}%<br/>
            床位: ${v[4]} 张/万人`;
        },
      },
      // Brush removed — ECharts parallel brush has a hardcoded blue fill
      // that cannot be made fully transparent (rgba color is ignored).
      // Instead, click on any line to select/deselect that region.
      // Selected lines = thick + full opacity; unselected = thin + faded.
      // Mortality-based green→red gradient always preserved.
      // ── Header row: graphic text above the parallel area ──
      //     Positions in pixels, matching parallel.left:70 + even spacing.
      //     First axis at 70px, last at containerWidth-70px, 3 middle spaced evenly.
      //     Use 'center' + offset for middle axes to handle variable width.
      graphic: (() => {
        const LABELS = ['人口密度 (人/km²)', '医生 (人/10万)', '确诊数 (例)', '死亡率 (%)', '床位 (张/万人)'];
        // Positions match parallel grid: left=70px (~8.75% of ~800px chart), right=70px (~91.25%).
        // 5 axes evenly distributed between 8.75% and 91.25%.
        const positions = ['8.75%', '29.4%', '50%', '70.6%', '91.25%'];
        return LABELS.map((text, i) => ({
          id: `header-label-${i}`,
          type: 'text',
          left: positions[i],
          top: 10,
          z: 100,
          style: {
            text, fontSize: 12, fontWeight: 'bold', fill: '#333',
            fontFamily: '-apple-system, "Noto Sans SC", sans-serif',
          },
        })).concat([{
          id: 'header-sep',
          type: 'line', z: 99,
          shape: { x1: '7%', y1: 32, x2: '93%', y2: 32 },
          style: { stroke: '#e0e0e0', lineWidth: 1 },
        }, {
          id: 'header-hint',
          type: 'text',
          left: 'center',
          top: 35,
          z: 100,
          style: {
            text: '🎨 色=省份  |  浓淡=死亡率  |  点击线条选中/取消  |  悬停查看数据  |  ✕ 清除',
            fontSize: 10, fill: '#aaa',
            fontFamily: '-apple-system, "Noto Sans SC", sans-serif',
          },
        }]);
      })(),
      parallelAxis: [
        { dim: 0, name: '', type: 'value', max: Math.max(1, maxValues[0]),
          axisLabel: { fontSize: 10, formatter: v => v > 500 ? (v/1000).toFixed(1)+'k' : v } },
        { dim: 1, name: '', type: 'value', max: Math.max(1, maxValues[1]),
          axisLabel: { fontSize: 10 } },
        { dim: 2, name: '', type: 'value', max: Math.max(1, maxValues[2]),
          axisLabel: { fontSize: 10 } },
        { dim: 3, name: '', type: 'value', max: Math.max(5, maxValues[3]),
          axisLabel: { fontSize: 10 } },
        { dim: 4, name: '', type: 'value', max: Math.max(1, maxValues[4]),
          axisLabel: { fontSize: 10 } },
      ],
      parallel: {
        left: 70, right: 70, top: 52, bottom: 24,
        parallelAxisDefault: {
          axisLabel: { fontSize: 10 },
          nameLocation: 'start', nameGap: 0,
        },
      },
      series: [{
        id: 'parallel-series',
        type: 'parallel',
        lineStyle: { width: 1.5, opacity: 0.75 },
        emphasis: { lineStyle: { width: 4, opacity: 1 } },
        data: merged.map(row => ({
          name: row.region,
          value: [...row.values, row.region],
          lineStyle: lineStyle(row, selectedSet),
        })),
      }],
    };
  }

  // ── Click on line → toggle single region ──
  chart.on('click', params => {
    if (params.componentType === 'series' && params.name) {
      const current = new Set(store.getState().selectedRegions);
      current.has(params.name) ? current.delete(params.name) : current.add(params.name);
      store.dispatch(setSelectedRegions([...current]));
    }
  });

  // ── Clear button (DOM element overlaid on chart) ──
  //     ECharts parallel coords click events are unreliable for detecting
  //     "background" clicks (it often still reports componentType:'series').
  //     A DOM button is a guaranteed, visible escape hatch.
  const clearBtn = document.createElement('button');
  clearBtn.textContent = '✕ 清除';
  clearBtn.title = '清除所有选中区域';
  Object.assign(clearBtn.style, {
    position: 'absolute',
    top: '6px',
    right: '10px',
    zIndex: '10',
    padding: '2px 10px',
    fontSize: '11px',
    cursor: 'pointer',
    border: '1px solid #ccc',
    borderRadius: '3px',
    background: '#fff',
    color: '#888',
    opacity: '0',
    transition: 'opacity 0.15s',
    pointerEvents: 'none',
  });
  dom.style.position = 'relative';
  dom.appendChild(clearBtn);

  // Show button only when there are selections
  function updateClearBtn(state) {
    const hasSelection = state.selectedRegions.length > 0;
    clearBtn.style.opacity = hasSelection ? '1' : '0';
    clearBtn.style.pointerEvents = hasSelection ? 'auto' : 'none';
  }

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    store.dispatch(setSelectedRegions([]));
  });

  // ── Store → render ──
  function render(state) {
    // replaceMerge: replace series data when time range changes
    // (old zones outside the new time window are removed, not merged)
    chart.setOption(buildOption(state), { notMerge: false, replaceMerge: ['series'] });
    updateClearBtn(state);
  }

  const unsub = store.subscribe(render);
  render(store.getState());

  return {
    render,
    resize: () => chart.resize(),
    destroy: () => { unsub(); chart.dispose(); clearBtn.remove(); },
  };
}
