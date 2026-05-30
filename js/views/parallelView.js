/**
 * View ③: Parallel Coordinates — multi-factor correlation analysis.
 * Brush axes → dispatches SET_PARALLEL_AXES_FILTER → map/timeline follow.
 */
import { setParallelAxesFilter } from '../actions.js';
import { filterCases, summarizeByRegion } from '../utils/dataLoader.js';

export function initParallel(dom, store, data) {
  const chart = echarts.init(dom);

  function buildOption(state) {
    const filtered = filterCases(data.cases, state);
    const summary = summarizeByRegion(filtered);

    // Merge with demographics for axes
    const merged = Object.values(summary).map(s => {
      const demo = (data.demographics || []).find(d => d.region === s.region) || {};
      const mortality = s.totalConfirmed > 0
        ? (s.totalDeaths / s.totalConfirmed * 100)
        : 0;
      return {
        name: s.region,
        popDensity: demo.population_density || 0,
        doctors: demo.doctors_per_100k || 0,
        cases: s.totalConfirmed,
        mortality: parseFloat(mortality.toFixed(1)),
        beds: demo.beds_per_10k || 0,
      };
    });

    const maxPopDens = Math.max(1, ...merged.map(d => d.popDensity));
    const maxCases = Math.max(1, ...merged.map(d => d.cases));
    const maxBeds = Math.max(1, ...merged.map(d => d.beds));

    return {
      backgroundColor: '#f5f7fa',
      tooltip: { trigger: 'item' },
      parallelAxis: [
        { dim: 0, name: '人口密度', type: 'value', max: maxPopDens, axisLabel: { fontSize: 8 }, nameTextStyle: { fontSize: 9 } },
        { dim: 1, name: '医生/10万人', type: 'value', axisLabel: { fontSize: 8 }, nameTextStyle: { fontSize: 9 } },
        { dim: 2, name: '确诊数', type: 'value', max: maxCases, axisLabel: { fontSize: 8 }, nameTextStyle: { fontSize: 9 } },
        { dim: 3, name: '死亡率(%)', type: 'value', max: 20, axisLabel: { fontSize: 8 }, nameTextStyle: { fontSize: 9 } },
        { dim: 4, name: '床位/万人', type: 'value', max: maxBeds, axisLabel: { fontSize: 8 }, nameTextStyle: { fontSize: 9 } },
      ],
      parallel: {
        left: 50, right: 50, top: 28, bottom: 16,
        parallelAxisDefault: {
          axisLabel: { fontSize: 8 },
          nameTextStyle: { fontSize: 9 },
          nameLocation: 'middle', nameGap: 16,
        },
      },
      series: [{
        type: 'parallel',
        lineStyle: {
          width: 1.5,
          opacity: 0.7,
          color: p => {
            const mortality = p.data[3] || 0;
            const t = Math.min(mortality / 15, 1);
            return `rgb(${Math.round(255*t)},${Math.round(255*(1-t))},${Math.round(100*(1-t))})`;
          },
        },
        emphasis: { lineStyle: { width: 3, opacity: 1 } },
        data: merged.map(d => [d.popDensity, d.doctors, d.cases, d.mortality, d.beds, d.name]),
      }],
    };
  }

  // Brush selection → dispatch axes filter
  chart.on('brushSelected', params => {
    if (params.batch && params.batch.length > 0) {
      const ranges = params.batch[0].selected;
      const filter = {};
      const dims = ['populationDensity', 'healthcareAccess', 'caseCount', 'mortalityRate'];
      for (const r of (ranges || [])) {
        if (r.dataIndex && r.dataIndex.length > 0) {
          filter[dims[r.axisIndex]] = [r.dataIndex[0], r.dataIndex[r.dataIndex.length - 1]];
        }
      }
      if (Object.keys(filter).length > 0) {
        store.dispatch(setParallelAxesFilter(filter));
      }
    }
  });

  function render(state) {
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
