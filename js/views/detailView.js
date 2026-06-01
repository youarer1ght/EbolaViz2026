/**
 * View ⑤: Detail Panel — stats cards (HTML) + region ranking bar chart (ECharts).
 *
 * Top section:  5 summary cards + filter context + selected demographics (HTML)
 * Bottom section: Horizontal bar chart — regions ranked by confirmed cases,
 *                 bar color encoded by CFR (green→red). Click to select.
 *
 * Coordination:
 *   Click bar → toggle region → SET_SELECTED_REGIONS → all views
 */
import { setSelectedRegions } from '../actions.js';
import { filterCases, summarizeByRegion, stateKeysEqual } from '../utils/dataLoader.js';

export function initDetail(dom, store, data) {

  // ── Helper: resolve ADM1 province ──
  function resolveAdm1(d, ugaMap) {
    if (d.country === 'UGA' && ugaMap && ugaMap[d.region]) return ugaMap[d.region];
    return d.province || d.region;
  }

  // ── Split dom: top half HTML cards, bottom half ECharts bar chart ──
  dom.innerHTML = `
    <div id="detail-cards" style="flex-shrink:0;"></div>
    <div id="detail-bars" style="flex:1;min-height:0;"></div>`;
  dom.style.display = 'flex';
  dom.style.flexDirection = 'column';

  const cardsDom = dom.querySelector('#detail-cards');
  const barsDom = dom.querySelector('#detail-bars');
  const barChart = echarts.init(barsDom);

  // ── Mortality color scale (same as parallelView's lineColor) ──
  function cfrColor(cfr) {
    const t = Math.min(1, Math.max(0, cfr / 20));
    return `rgb(${Math.round(255*t)},${Math.round(200*(1-t))},${Math.round(100*(1-t))})`;
  }

  // ── Build stats cards HTML ──
  function buildCardsHTML(state, filtered, summary) {
    const rows = Object.values(summary).sort((a, b) => b.totalConfirmed - a.totalConfirmed);

    let totalConfirmed = 0, totalDeaths = 0, totalSuspected = 0;
    for (const s of rows) {
      totalConfirmed += s.totalConfirmed;
      totalDeaths += s.totalDeaths;
      totalSuspected += s.totalSuspected;
    }
    const cfr = totalConfirmed > 0 ? (totalDeaths / totalConfirmed * 100).toFixed(1) : '0.0';

    // Filter context
    const selCount = state.selectedRegions.length;
    const allRegionsWithCases = [...new Set(data.cases
      .filter(c => !state.timeRange || (c.date >= state.timeRange[0] && c.date <= state.timeRange[1]))
      .map(c => c.region))];
    const regionInfo = selCount > 0
      ? `<b style="color:#d32f2f;">${selCount}</b> / ${allRegionsWithCases.length} 区域已选`
      : `<span style="color:#666;">全部 ${allRegionsWithCases.length} 区域</span>`;

    const timeInfo = state.timeRange
      ? `${state.timeRange[0]} ~ ${state.timeRange[1]}` : '全部时段';

    let policyInfo = '无';
    if (state.selectedPolicyIds.length > 0) {
      policyInfo = state.selectedPolicyIds.map(pid => {
        const p = (data.policies || []).find(ev => ev.id === pid);
        return p ? p.title : pid;
      }).join('; ');
    }

    // Demographics for selected regions
    let demoHTML = '';
    if (selCount > 0 && data.demographics) {
      const demos = state.selectedRegions
        .map(r => data.demographics.find(d => d.region === r))
        .filter(Boolean);
      if (demos.length > 0) {
        const totalPop = demos.reduce((s, d) => s + (d.population || 0), 0);
        const avgDensity = Math.round(demos.reduce((s, d) => s + (d.population_density || 0), 0) / demos.length);
        const avgUrban = Math.round(demos.reduce((s, d) => s + (d.urban_pct || 0), 0) / demos.length);
        const avgDoctors = (demos.reduce((s, d) => s + (d.doctors_per_100k || 0), 0) / demos.length).toFixed(1);
        const avgBeds = (demos.reduce((s, d) => s + (d.beds_per_10k || 0), 0) / demos.length).toFixed(1);
        const ugaMap = data.ugaDistrictRegion;
        const provinces = [...new Set(demos.map(d => resolveAdm1(d, ugaMap)))].join('、');
        demoHTML = `
          <div style="padding:4px 8px;background:#f3f8ff;border-radius:4px;font-size:0.7rem;line-height:1.5;border-left:3px solid #1f77b4;">
            <b>📋 已选区域</b> (${demos.length}区: ${provinces})
            <span style="display:flex;gap:14px;flex-wrap:wrap;color:#555;">
              <span>👥 ${(totalPop/1e4).toFixed(0)}万</span>
              <span>📐 ${avgDensity}/km²</span>
              <span>🏙 ${avgUrban}%</span>
              <span>🩺 ${avgDoctors}/10万</span>
              <span>🛏 ${avgBeds}/万人</span>
            </span>
          </div>`;
      }
    }

    return `
      <div style="padding:6px 8px 4px;font-size:0.72rem;line-height:1.6;">
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:4px;font-size:0.68rem;color:#555;">
          <span>📍 ${regionInfo}</span>
          <span>📅 ${timeInfo}</span>
          <span>📋 ${policyInfo}</span>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:4px;">
          <div style="flex:1;min-width:0;background:#fff3e0;padding:4px;border-radius:3px;text-align:center;">
            <div style="font-size:0.58rem;color:#999;">确诊</div>
            <div style="font-weight:bold;font-size:0.95rem;color:#d32f2f;">${totalConfirmed}</div>
          </div>
          <div style="flex:1;min-width:0;background:#fce4ec;padding:4px;border-radius:3px;text-align:center;">
            <div style="font-size:0.58rem;color:#999;">死亡</div>
            <div style="font-weight:bold;font-size:0.95rem;">${totalDeaths}</div>
          </div>
          <div style="flex:1;min-width:0;background:#f3e5f5;padding:4px;border-radius:3px;text-align:center;">
            <div style="font-size:0.58rem;color:#999;">CFR</div>
            <div style="font-weight:bold;font-size:0.95rem;color:${parseFloat(cfr)>5?'#d32f2f':'#333'};">${cfr}%</div>
          </div>
          <div style="flex:1;min-width:0;background:#e8eaf6;padding:4px;border-radius:3px;text-align:center;">
            <div style="font-size:0.58rem;color:#999;">含疑似</div>
            <div style="font-weight:bold;font-size:0.95rem;">${(totalConfirmed+totalSuspected)}</div>
          </div>
          <div style="flex:1;min-width:0;background:#e8f5e9;padding:4px;border-radius:3px;text-align:center;">
            <div style="font-size:0.58rem;color:#999;">疫区</div>
            <div style="font-weight:bold;font-size:0.95rem;">${rows.length}</div>
          </div>
        </div>
        ${demoHTML}
      </div>`;
  }

  // ── Build ECharts bar chart option ──
  function buildBarOption(state, filtered, summary) {
    const rows = Object.values(summary)
      .filter(r => r.totalConfirmed > 0)
      .sort((a, b) => b.totalConfirmed - a.totalConfirmed);

    const selectedSet = new Set(state.selectedRegions);
    const maxVal = Math.max(1, ...rows.map(r => r.totalConfirmed));

    // Build bar data — top regions by confirmed cases
    const barData = rows.map(r => {
      const rCFR = r.totalConfirmed > 0 ? (r.totalDeaths / r.totalConfirmed * 100) : 0;
      const isSelected = selectedSet.has(r.region);
      return {
        name: r.region,
        value: r.totalConfirmed,
        deaths: r.totalDeaths,
        cfr: rCFR,
        itemStyle: {
          color: isSelected ? '#ff8f00' : cfrColor(rCFR),
          borderColor: isSelected ? '#333' : 'transparent',
          borderWidth: isSelected ? 2 : 0,
          borderRadius: [0, 3, 3, 0],
        },
        label: {
          show: r.totalConfirmed > maxVal * 0.08 || isSelected,
          formatter: '{b}',
          position: 'right',
          fontSize: isSelected ? 11 : 9,
          fontWeight: isSelected ? 'bold' : 'normal',
          color: isSelected ? '#333' : '#555',
        },
        emphasis: {
          itemStyle: { borderColor: '#333', borderWidth: 1.5 },
          label: { fontSize: 11, fontWeight: 'bold' },
        },
      };
    });

    // Don't show too few bars (looks sparse)
    const showCount = Math.max(15, Math.min(barData.length, 40));

    return {
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'shadow' },
        formatter: p => {
          if (!p || p.length === 0) return '';
          const d = p[0].data;
          return `<b>${d.name}</b><br/>
            确诊: <b>${d.value}</b> | 死亡: <b>${d.deaths}</b><br/>
            CFR: <b style="color:${cfrColor(d.cfr)};">${d.cfr.toFixed(1)}%</b><br/>
            <em style="color:#888;">📌 点击选中/取消该区域</em>`;
        },
      },
      grid: { top: 2, right: 120, bottom: 2, left: 4 },
      xAxis: {
        type: 'value',
        axisLabel: { fontSize: 8, formatter: v => v >= 1000 ? (v/1000).toFixed(0)+'k' : v },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      yAxis: {
        type: 'category',
        inverse: true,  // top-ranked at top
        data: barData.slice(0, showCount).map(d => d.name),
        axisLabel: { fontSize: 9, width: 110, overflow: 'truncate' },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [{
        type: 'bar',
        data: barData.slice(0, showCount),
        barMaxWidth: 16,
        emphasis: {
          itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.2)' },
        },
      }],
    };
  }

  // ── Bar click → toggle region ──
  barChart.on('click', params => {
    if (params.componentType === 'series' && params.name) {
      const current = new Set(store.getState().selectedRegions);
      current.has(params.name) ? current.delete(params.name) : current.add(params.name);
      store.dispatch(setSelectedRegions([...current]));
    }
  });

  // ── Store → render ──
  const _DETAIL_KEYS = ['timeRange', 'animatingDate', 'selectedRegions', 'selectedPolicyIds'];
  let _lastRendered = null;

  function render(state) {
    // Skip re-render if relevant state hasn't changed (e.g. hover)
    if (_lastRendered && stateKeysEqual(_lastRendered, state, _DETAIL_KEYS)) return;
    _lastRendered = { timeRange: state.timeRange, animatingDate: state.animatingDate, selectedRegions: state.selectedRegions, selectedPolicyIds: state.selectedPolicyIds };
    // Compute filtered data once — shared by cards HTML and bar chart
    const filtered = filterCases(data.cases, state);
    const summary = summarizeByRegion(filtered);
    cardsDom.innerHTML = buildCardsHTML(state, filtered, summary);
    barChart.setOption(buildBarOption(state, filtered, summary), true);
  }

  const unsub = store.subscribe(render);
  render(store.getState());

  return {
    render,
    resize: () => barChart.resize(),
    destroy: () => { unsub(); barChart.dispose(); dom.innerHTML = ''; },
  };
}
