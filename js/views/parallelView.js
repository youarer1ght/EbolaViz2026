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
            人口密度: ${v[0]}<br/>
            医生/10万: ${v[1]}<br/>
            确诊: ${v[2]}<br/>
            死亡率: ${v[3]}%<br/>
            床位/万: ${v[4]}`;
        },
      },
      brush: {
        toolbox: ['rect', 'clear'],
        throttleType: 'debounce',
        throttleDelay: 200,
        brushLink: [],
        inBrush: { opacity: 1, lineWidth: 3 },
        outOfBrush: { opacity: 0.15, lineWidth: 1 },
        brushStyle: { borderWidth: 1, color: 'rgba(31,119,180,0.2)', borderColor: '#1f77b4' },
      },
      parallelAxis: [
        { dim: 0, name: '人口密度', type: 'value', max: Math.max(1, maxValues[0]),
          axisLabel: { fontSize: 10, formatter: v => v > 500 ? (v/1000).toFixed(1)+'k' : v },
          nameTextStyle: { fontSize: 12, fontWeight: 'bold',
            backgroundColor: 'rgba(245,247,250,0.92)', padding: [2, 5], borderRadius: 3 } },
        { dim: 1, name: '医生/10万人', type: 'value', max: Math.max(1, maxValues[1]),
          axisLabel: { fontSize: 10 },
          nameTextStyle: { fontSize: 12, fontWeight: 'bold',
            backgroundColor: 'rgba(245,247,250,0.92)', padding: [2, 5], borderRadius: 3 } },
        { dim: 2, name: '确诊数', type: 'value', max: Math.max(1, maxValues[2]),
          axisLabel: { fontSize: 10 },
          nameTextStyle: { fontSize: 12, fontWeight: 'bold',
            backgroundColor: 'rgba(245,247,250,0.92)', padding: [2, 5], borderRadius: 3 } },
        { dim: 3, name: '死亡率(%)', type: 'value', max: Math.max(5, maxValues[3]),
          axisLabel: { fontSize: 10 },
          nameTextStyle: { fontSize: 12, fontWeight: 'bold',
            backgroundColor: 'rgba(245,247,250,0.92)', padding: [2, 5], borderRadius: 3 } },
        { dim: 4, name: '床位/万人', type: 'value', max: Math.max(1, maxValues[4]),
          axisLabel: { fontSize: 10 },
          nameTextStyle: { fontSize: 12, fontWeight: 'bold',
            backgroundColor: 'rgba(245,247,250,0.92)', padding: [2, 5], borderRadius: 3 } },
      ],
      parallel: {
        left: 70, right: 70, top: 44, bottom: 24,
        parallelAxisDefault: {
          axisLabel: { fontSize: 10 },
          nameTextStyle: { fontSize: 12, fontWeight: 'bold',
            backgroundColor: 'rgba(245,247,250,0.92)', padding: [2, 5], borderRadius: 3 },
          nameLocation: 'middle', nameGap: 22,
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

  // ── Brush → region selection ──
  let lastBrushed = null;

  function handleBrush(params) {
    if (!params.batch || params.batch.length === 0) return;

    const indices = new Set();
    for (const b of params.batch) {
      for (const sel of (b.selected || [])) {
        if (sel.dataIndex) {
          for (const i of sel.dataIndex) indices.add(i);
        }
      }
    }

    const merged = buildMerged(data.cases);
    const regions = [];
    for (const i of indices) {
      if (i >= 0 && i < merged.length) regions.push(merged[i].region);
    }

    const key = [...regions].sort().join(',');
    if (key !== lastBrushed) {
      lastBrushed = key;
      store.dispatch(setSelectedRegions(regions));
    }
  }

  chart.on('brushSelected', handleBrush);
  chart.on('brushEnd', handleBrush);  // Belt-and-suspenders: both events

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
