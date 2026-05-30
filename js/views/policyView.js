/**
 * View ④: Policy Timeline — scatter markers on case trend background.
 * Click policy marker → dispatches SET_SELECTED_POLICY_IDS.
 */
import { setSelectedPolicyIds } from '../actions.js';
import { filterCases } from '../utils/dataLoader.js';
import { POLICY } from '../utils/colors.js';

export function initPolicy(dom, store, data) {
  const chart = echarts.init(dom);

  function buildOption(state) {
    // Filter policies by time range and region
    let policies = data.policies || [];
    if (state.timeRange && state.timeRange.length === 2) {
      policies = policies.filter(p => p.date >= state.timeRange[0] && p.date <= state.timeRange[1]);
    }
    if (state.selectedRegions.length > 0) {
      policies = policies.filter(p => state.selectedRegions.includes(p.region));
    }

    // Build daily case totals as background
    const filtered = filterCases(data.cases, state);
    const dailyTotals = {};
    for (const c of filtered) {
      dailyTotals[c.date] = (dailyTotals[c.date] || 0) + (c.new_cases || c.suspected_cases || 0);
    }
    const caseLine = Object.entries(dailyTotals)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, val]) => [date, val]);

    // Policy markers
    const markerData = policies.map((p, i) => ({
      name: p.title,
      value: [p.date, dailyTotals[p.date] || 0, p.id, p.type, p.description, p.source],
      symbolSize: 16,
      itemStyle: {
        color: POLICY[p.type] || '#999',
        borderColor: state.selectedPolicyIds.includes(p.id) ? '#000' : '#fff',
        borderWidth: state.selectedPolicyIds.includes(p.id) ? 2 : 0.5,
      },
      policyIndex: i,
    }));

    // Selected policy vertical lines
    const markLines = state.selectedPolicyIds.map(pid => {
      const p = policies.find(ev => ev.id === pid);
      if (!p) return null;
      return { xAxis: p.date, label: { show: true, formatter: p.title.slice(0, 12) + '…', fontSize: 8 }, lineStyle: { color: POLICY[p.type] || '#999', type: 'dashed', width: 1 } };
    }).filter(Boolean);

    return {
      backgroundColor: '#f5f7fa',
      tooltip: {
        trigger: 'item',
        formatter: params => {
          if (params.componentType === 'series' && params.seriesType === 'scatter') {
            const d = params.data;
            return `<b>📌 ${d[0]}</b><br/>
              <b>${params.name}</b><br/>
              类型: ${d[3]} | 来源: ${d[5]}<br/>
              <em>${d[4]}</em>`;
          }
          return `${params.value[0]}<br/>病例: ${params.value[1]}`;
        },
      },
      grid: { top: 8, right: 16, bottom: 28, left: 48 },
      xAxis: {
        type: 'time',
        axisLabel: { fontSize: 8, rotate: 25 },
        name: '日期',
        nameTextStyle: { fontSize: 9 },
      },
      yAxis: {
        type: 'value',
        name: '病例数',
        axisLabel: { fontSize: 8 },
      },
      series: [
        {
          name: '每日病例趋势',
          type: 'line',
          data: caseLine,
          symbol: 'none',
          lineStyle: { color: '#ddd', width: 1 },
          z: 1,
          silent: true,
        },
        {
          name: '政策/事件节点',
          type: 'scatter',
          data: markerData,
          z: 10,
          markLine: markLines.length > 0 ? { silent: true, symbol: 'none', data: markLines } : undefined,
        },
      ],
    };
  }

  // Click policy → select/unselect
  chart.on('click', params => {
    if (params.componentType === 'series' && params.seriesType === 'scatter' && params.data) {
      const policyId = params.data.value[2];
      if (!policyId) return;
      const current = store.getState().selectedPolicyIds;
      const next = current.includes(policyId)
        ? current.filter(id => id !== policyId)
        : [...current, policyId];
      store.dispatch(setSelectedPolicyIds(next));
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
