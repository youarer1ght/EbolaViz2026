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
        brushMode: 'multiple',       // allow brushing on multiple axes simultaneously
        removeOnClick: false,        // don't clear on click — use clear button instead
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
          type: 'text',
          left: positions[i],
          top: 10,
          z: 100,
          style: {
            text, fontSize: 12, fontWeight: 'bold', fill: '#333',
            fontFamily: '-apple-system, "Noto Sans SC", sans-serif',
          },
        })).concat([{
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
  //     Tracks per-axis brushed ranges via params.areas so intersection
  //     works regardless of how ECharts structures the batch/selected data.
  let lastBrushed = null;
  const axisRanges = [null, null, null, null, null]; // per-dim [min,max]

  function handleBrush(params) {
    const merged = buildMerged(data.cases);

    // ── Brush cleared (toolbox clear button) ──
    if (!params.areas || params.areas.length === 0) {
      for (let d = 0; d < 5; d++) axisRanges[d] = null;
      lastBrushed = null;
      store.dispatch(setSelectedRegions([]));
      return;
    }

    // ── Update per-axis ranges from active brush areas ──
    //     Reset all first, then fill from params.areas.
    //     areas[] order matches the axis index order in parallel coords.
    for (let d = 0; d < 5; d++) axisRanges[d] = null;
    for (const area of params.areas) {
      if (area.brushType === 'rect' && area.coordRange) {
        // Determine axis index: use area.axisIndex if available,
        // otherwise infer from area's position in the parallel grid.
        // Fallback: match coordRange magnitude against per-axis max values.
        const dim = area.axisIndex != null ? area.axisIndex
                  : area.dim != null ? area.dim
                  : inferAxisByRange(area.coordRange, merged);
        if (dim >= 0 && dim < 5) {
          axisRanges[dim] = area.coordRange;
        }
      }
    }

    // ── If no ranges could be parsed, fall back to batch intersection ──
    const hasRanges = axisRanges.some(r => r !== null);
    if (!hasRanges) {
      // Fallback: use batch data-index intersection (original logic)
      const batchSets = [];
      for (const b of (params.batch || [])) {
        const s = new Set();
        for (const sel of (b.selected || [])) {
          if (sel.dataIndex) for (const i of sel.dataIndex) s.add(i);
        }
        if (s.size > 0) batchSets.push(s);
      }
      if (batchSets.length === 0) return;
      const inter = new Set(batchSets[0]);
      for (let i = 1; i < batchSets.length; i++) {
        for (const idx of inter) if (!batchSets[i].has(idx)) inter.delete(idx);
      }
      const regions = [...inter].filter(i => i >= 0 && i < merged.length).map(i => merged[i].region);
      const key = regions.sort().join(',');
      if (key !== lastBrushed) { lastBrushed = key; store.dispatch(setSelectedRegions(regions)); }
      return;
    }

    // ── Primary path: AND intersection across all active axis ranges ──
    const regions = [];
    for (let i = 0; i < merged.length; i++) {
      const vals = merged[i].values;
      let ok = true;
      for (let d = 0; d < 5; d++) {
        const range = axisRanges[d];
        if (!range) continue;           // no filter on this axis
        if (vals[d] < range[0] || vals[d] > range[1]) {
          ok = false;
          break;
        }
      }
      if (ok) regions.push(merged[i].region);
    }

    const key = regions.sort().join(',');
    if (key !== lastBrushed) {
      lastBrushed = key;
      store.dispatch(setSelectedRegions(regions));
    }
  }

  /** Guess which parallel axis a coordRange belongs to by value magnitude. */
  function inferAxisByRange(range, merged) {
    if (!merged || merged.length === 0) return -1;
    // Compute per-axis max from merged data
    const maxes = [0, 0, 0, 0, 0];
    for (const row of merged) {
      for (let d = 0; d < 5; d++) {
        if (row.values[d] > maxes[d]) maxes[d] = row.values[d];
      }
    }
    const rangeMax = Math.max(Math.abs(range[0]), Math.abs(range[1]));
    let bestDim = -1, bestDist = Infinity;
    for (let d = 0; d < 5; d++) {
      const dist = Math.abs(maxes[d] - rangeMax);
      if (dist < bestDist) { bestDist = dist; bestDim = d; }
    }
    return bestDim;
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
    // Don't rebuild on hover-only changes (highlightedRegions)
    chart.setOption(buildOption(state), true);
  }

  const unsub = store.subscribe(render);
  render(store.getState());

  return {
    render,
    resize: () => chart.resize(),
    destroy: () => { unsub(); chart.dispose(); },
  };
}
