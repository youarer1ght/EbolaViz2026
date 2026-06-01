/**
 * View ④: Policy Timeline — scatter markers on case trend background.
 * Click policy marker → dispatches SET_SELECTED_POLICY_IDS.
 */
import { setSelectedPolicyIds } from '../actions.js';
import { filterCases, stateKeysEqual } from '../utils/dataLoader.js';
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

    // Build daily case totals as background trend line.
    // Use time-range only (ignore animatingDate + region selection) so the
    // trend line stays stable and informative during animation playback.
    const bgState = { ...state, animatingDate: null, selectedRegions: [] };
    const bgCases = filterCases(data.cases, bgState);
    const dailyTotals = {};
    for (const c of bgCases) {
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

    // Selected policy vertical lines — use UNFILTERED data.policies so
    // markLines for selected policies don't silently disappear when time
    // range or region filter excludes the policy's date/region.
    const allPolicies = data.policies || [];
    // Stagger markLine labels by date proximity to avoid overlap:
    // sort by date, cluster within 2-day windows, cycle top→center→bottom.
    const sortedIds = [...state.selectedPolicyIds].sort((a, b) => {
      const pa = allPolicies.find(p => p.id === a);
      const pb = allPolicies.find(p => p.id === b);
      return (pa?.date || '').localeCompare(pb?.date || '');
    });

    const POSITIONS = ['end', 'middle', 'start'];  // top, center, bottom
    const posMap = {};
    let clusterIdx = 0;
    let prevDate = null;
    for (const pid of sortedIds) {
      const p = allPolicies.find(ev => ev.id === pid);
      const curDate = p?.date || '';
      if (prevDate && (new Date(curDate) - new Date(prevDate)) / 864e5 > 2) {
        clusterIdx = 0;
      }
      posMap[pid] = POSITIONS[clusterIdx % POSITIONS.length];
      clusterIdx++;
      prevDate = curDate;
    }

    // Build markLines: fixed-width labels with word-wrap so long names
    // become tall+narrow instead of short+wide → much less horizontal overlap.
    const markLines = state.selectedPolicyIds.map(pid => {
      const p = allPolicies.find(ev => ev.id === pid);
      if (!p) return null;
      return {
        xAxis: p.date,
        label: {
          show: true,
          formatter: p.title,
          fontSize: 7,
          width: 64,
          overflow: 'break',
          position: posMap[pid],
          distance: 4,
        },
        lineStyle: { color: POLICY[p.type] || '#999', type: 'dashed', width: 1 },
      };
    }).filter(Boolean);

    return {
      backgroundColor: '#f5f7fa',
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: params => {
          if (params.componentType === 'series' && params.seriesType === 'scatter') {
            // params.value is always the raw array, even when data is an object
            const v = params.value || [];
            return `<b>📌 ${v[0]}</b><br/>
              <b>${params.name}</b><br/>
              类型: ${v[3]} | 来源: ${v[5]}<br/>
              <em>${v[4]}</em>`;
          }
          return `${params.value[0]}<br/>病例: ${params.value[1]}`;
        },
      },
      grid: { top: 46, right: 16, bottom: 28, left: 48 },
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

  const _POLICY_KEYS = ['timeRange', 'selectedRegions', 'selectedPolicyIds'];
  let _lastRendered = null;

  function render(state) {
    // Skip re-render if relevant state hasn't changed (e.g. hover, animation)
    if (_lastRendered && stateKeysEqual(_lastRendered, state, _POLICY_KEYS)) return;
    _lastRendered = { timeRange: state.timeRange, selectedRegions: state.selectedRegions, selectedPolicyIds: state.selectedPolicyIds };
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
