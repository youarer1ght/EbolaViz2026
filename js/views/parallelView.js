/**
 * View ③: Parallel Coordinates — multi-factor correlation analysis.
 *
 * Coordination:
 *   Brush on axes → extract selected region names → dispatch
 *   SET_SELECTED_REGIONS → heatmap / timeline / detail filter.
 *   Click on a line → toggle that region's selection.
 *
 * Selection styling: selected lines are gold and thick; unselected
 * keep their mortality-based color at reduced opacity for context.
 */
import { setSelectedRegions } from '../actions.js';
import { filterCases, summarizeByRegion } from '../utils/dataLoader.js';

export function initParallel(dom, store, data) {

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

  /** Per-line base color: green (low mortality) → red (high mortality). */
  function lineColor(mortality) {
    const t = Math.min(1, Math.max(0, mortality / 20));
    return `rgb(${Math.round(255*t)},${Math.round(200*(1-t))},${Math.round(100*(1-t))})`;
  }

  /** Selection-aware style: keep color encoding, vary thickness + opacity. */
  function lineStyle(row, selectedSet) {
    const baseColor = lineColor(row.values[3]);
    if (selectedSet.has(row.region)) {
      return { color: baseColor, width: 3.5, opacity: 1 };
    }
    return { color: baseColor, width: 1, opacity: 0.45 };
  }

  // ── Init ──
  const chart = echarts.init(dom);

  function buildOption(state) {
    // Use unfiltered data for rendering so all zones are visible;
    // selection state drives visual emphasis only.
    const merged = buildMerged(data.cases);
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
          return `<b>${p.name}</b><br/>
            人口密度: ${v[0]} 人/km²<br/>
            医生: ${v[1]} 人/10万<br/>
            确诊: ${v[2]} 例<br/>
            死亡率: ${v[3]}%<br/>
            床位: ${v[4]} 张/万人`;
        },
      },
      brush: {
        toolbox: ['rect', 'clear'],
        throttleType: 'debounce',
        throttleDelay: 200,
        // Note: ECharts only keeps the most recent brush area on parallel axes.
        // Multi-axis AND is handled by our custom axisRanges accumulator in handleBrush.
        inBrush: { opacity: 1, lineWidth: 3 },
        outOfBrush: { opacity: 0.15, lineWidth: 1 },
        brushStyle: { borderWidth: 1, color: 'rgba(31,119,180,0.2)', borderColor: '#1f77b4' },
      },
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
        left: 70, right: 70, top: 46, bottom: 24,
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

  // ── Brush → region selection (multi-axis AND intersection) ──
  //     ECharts parallel coords only keeps the most recent brush visually;
  //     previous brush areas disappear.  We work around this by accumulating
  //     selected data-index sets across brush events via simple set intersection.
  //     Only the toolbox clear button (empty batch) resets the accumulator.
  let lastBrushed = null;
  let accumulatedIndices = null; // Set of data indices accumulated across brushes

  function handleBrush(params) {
    const merged = buildMerged(data.cases);

    // ── Collect data indices from current brush event ──
    const currentIndices = new Set();
    for (const b of (params.batch || [])) {
      for (const sel of (b.selected || [])) {
        if (sel.dataIndex) {
          for (const i of sel.dataIndex) currentIndices.add(i);
        }
      }
    }

    // ── No selection (clear button or empty brush) → reset ──
    if (currentIndices.size === 0) {
      accumulatedIndices = null;
      lastBrushed = null;
      store.dispatch(setSelectedRegions([]));
      console.log('🔍 框选已清除');
      return;
    }

    // ── Accumulate: intersect with previous brush results ──
    if (accumulatedIndices === null) {
      accumulatedIndices = new Set(currentIndices);
    } else {
      // AND: keep only indices present in BOTH the new brush and the accumulator
      accumulatedIndices = new Set(
        [...accumulatedIndices].filter(i => currentIndices.has(i))
      );
    }

    // ── Resolve indices → region names ──
    const regions = [...accumulatedIndices]
      .filter(i => i >= 0 && i < merged.length)
      .map(i => merged[i].region);

    const key = regions.sort().join(',');
    if (key !== lastBrushed) {
      lastBrushed = key;
      console.log(`🔍 累积框选: ${accumulatedIndices.size} 个区域 → ${regions.length} 个卫生区`, regions);
      store.dispatch(setSelectedRegions(regions));
    } else {
      console.log(`🔍 累积框选: ${accumulatedIndices.size} 个区域 (未变化)`, regions);
    }
  }

  chart.on('brushSelected', handleBrush);
  chart.on('brushEnd', handleBrush);

  // ── Click on line → toggle single region ──
  chart.on('click', params => {
    if (params.componentType === 'series' && params.name) {
      const current = new Set(store.getState().selectedRegions);
      current.has(params.name) ? current.delete(params.name) : current.add(params.name);
      const next = [...current];
      lastBrushed = next.sort().join(',');
      store.dispatch(setSelectedRegions(next));
    }
  });

  // ── Store → render ──
  function render(state) {
    // notMerge:false preserves brush state across render cycles.
    // Without this, setOption(...,true) destroys active brush areas
    // every time the store updates, breaking multi-axis accumulation.
    chart.setOption(buildOption(state), false);
  }

  const unsub = store.subscribe(render);
  render(store.getState());

  return {
    render,
    resize: () => chart.resize(),
    destroy: () => { unsub(); chart.dispose(); },
  };
}
