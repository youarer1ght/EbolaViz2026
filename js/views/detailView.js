/**
 * View ⑤: Detail Panel — aggregate statistics and regional breakdown.
 *
 * Pure HTML rendering (no ECharts). Reads store state and data to
 * compute summary statistics, CFR, regional ranking, and selected-
 * region demographic context.
 */
import { filterCases, summarizeByRegion } from '../utils/dataLoader.js';

export function initDetail(dom, store, data) {

  /** Resolve ADM1 province name (same logic as heatmapView). */
  function resolveAdm1(d, ugaMap) {
    if (d.country === 'UGA' && ugaMap && ugaMap[d.region]) {
      return ugaMap[d.region];
    }
    return d.province || d.region;
  }

  /** Resolve demographic info for selected region(s). */
  function selectedDemographics(selectedRegions) {
    if (!data.demographics || selectedRegions.length === 0) return null;
    const demos = selectedRegions
      .map(r => data.demographics.find(d => d.region === r))
      .filter(Boolean);
    if (demos.length === 0) return null;

    // Aggregate: sum populations, average rates
    const ugaMap = data.ugaDistrictRegion;
    const info = {
      totalPop: demos.reduce((s, d) => s + (d.population || 0), 0),
      avgDensity: Math.round(demos.reduce((s, d) => s + (d.population_density || 0), 0) / demos.length),
      avgUrban: Math.round(demos.reduce((s, d) => s + (d.urban_pct || 0), 0) / demos.length),
      avgDoctors: (demos.reduce((s, d) => s + (d.doctors_per_100k || 0), 0) / demos.length).toFixed(1),
      avgBeds: (demos.reduce((s, d) => s + (d.beds_per_10k || 0), 0) / demos.length).toFixed(1),
      zoneCount: demos.length,
      // Use same ADM1 resolution as heatmap so province names match
      provinceList: [...new Set(demos.map(d => resolveAdm1(d, ugaMap)))].join('、'),
    };
    return info;
  }

  function buildHTML(state) {
    const filtered = filterCases(data.cases, state);
    const summary = summarizeByRegion(filtered);

    // Totals
    let totalConfirmed = 0, totalDeaths = 0, totalSuspected = 0;
    const regionRows = Object.values(summary)
      .sort((a, b) => b.totalConfirmed - a.totalConfirmed);

    for (const s of regionRows) {
      totalConfirmed += s.totalConfirmed;
      totalDeaths += s.totalDeaths;
      totalSuspected += s.totalSuspected;
    }
    const cfr = totalConfirmed > 0
      ? (totalDeaths / totalConfirmed * 100).toFixed(1) : '0.0';

    // State context — count distinct regions WITH CASE DATA (not demographics total)
    const selCount = state.selectedRegions.length;
    // All distinct regions that appear in case data (time-filtered, but ignoring region selection)
    const allRegionsWithCases = [...new Set(data.cases
      .filter(c => state.timeRange
        ? (c.date >= state.timeRange[0] && c.date <= state.timeRange[1])
        : true)
      .map(c => c.region))];
    const totalCaseRegions = allRegionsWithCases.length;
    const regionInfo = selCount > 0
      ? `<b style="color:#d32f2f;">${selCount}</b> / ${totalCaseRegions} 区域已选`
      : `<span style="color:#666;">全部 ${totalCaseRegions} 区域</span>`;

    const timeInfo = state.timeRange
      ? `${state.timeRange[0]} ~ ${state.timeRange[1]}`
      : '全部时段';

    let policyInfo = '无';
    if (state.selectedPolicyIds.length > 0) {
      policyInfo = state.selectedPolicyIds.map(pid => {
        const p = (data.policies || []).find(ev => ev.id === pid);
        return p ? p.title : pid;
      }).join('; ');
    }

    // Region table
    const maxConfirmed = Math.max(1, ...regionRows.map(r => r.totalConfirmed));
    const maxDeaths = Math.max(1, ...regionRows.map(r => r.totalDeaths));

    const tableRows = regionRows.length > 0
      ? regionRows.map(r => {
          const rCFR = r.totalConfirmed > 0
            ? (r.totalDeaths / r.totalConfirmed * 100).toFixed(1) : '0.0';
          const isSelected = selCount === 0 || state.selectedRegions.includes(r.region);
          const caseIntensity = r.totalConfirmed / maxConfirmed;
          const deathBarW = maxDeaths > 0 ? Math.round((r.totalDeaths / maxDeaths) * 60) : 0;
          return `
            <tr style="${isSelected ? '' : 'opacity:0.35;'}">
              <td><span style="font-weight:${caseIntensity>0.3?'bold':'normal'};">${r.region}</span>
                <span style="color:#999;font-size:0.65rem;"> ${r.country}</span></td>
              <td style="text-align:right;color:${caseIntensity>0.5?'#d32f2f':'#333'};font-weight:${caseIntensity>0.5?'bold':'normal'};">
                ${r.totalConfirmed}</td>
              <td style="text-align:right;">${r.totalDeaths}
                <span style="display:inline-block;width:${deathBarW}px;height:4px;background:#e57373;border-radius:2px;vertical-align:middle;margin-left:3px;"></span></td>
              <td style="text-align:right;color:${parseFloat(rCFR)>10?'#d32f2f':'#666'};font-weight:${parseFloat(rCFR)>10?'bold':'normal'};">
                ${rCFR}%</td>
              <td style="text-align:right;font-size:0.7rem;color:#888;">${r.totalSuspected>0?r.totalSuspected+'疑':'-'}</td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="5" style="text-align:center;color:#999;">暂无数据</td></tr>';

    // Demographic detail (shown when 1+ zones selected)
    let demoHTML = '';
    if (selCount > 0) {
      const info = selectedDemographics(state.selectedRegions);
      if (info) {
        const countryLabel = state.selectedRegions.some(r =>
          ['Kampala','Kisoro','Kanungu','Arua','Bundibugyo'].includes(r)
        ) ? '刚果(金)/乌干达' : '刚果(金)';
        demoHTML = `
          <div style="margin-bottom:8px;padding:6px 8px;background:#f3f8ff;border-radius:4px;font-size:0.72rem;line-height:1.6;border-left:3px solid #1f77b4;">
            <b>📋 已选区域概况</b>
            <span style="color:#888;font-size:0.65rem;"> (${info.zoneCount}区: ${info.provinceList})</span>
            <span style="color:#888;font-size:0.65rem;"> · ${countryLabel}</span>
            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:2px;color:#555;">
              <span>👥 人口: <b>${(info.totalPop/10000).toFixed(0)}万</b></span>
              <span>📐 密度: ${info.avgDensity}/km²</span>
              <span>🏙 城镇化: ${info.avgUrban}%</span>
              <span>🩺 医生: ${info.avgDoctors}/10万</span>
              <span>🛏 床位: ${info.avgBeds}/万人</span>
            </div>
          </div>`;
      }
    }

    // Assemble
    return `
      <div style="padding:6px 8px;font-size:0.78rem;line-height:1.8;height:100%;display:flex;flex-direction:column;">
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:4px;font-size:0.7rem;color:#555;">
          <span>📍 ${regionInfo}</span>
          <span>📅 ${timeInfo}</span>
          <span>📋 政策: ${policyInfo}</span>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <div style="flex:1;min-width:0;background:#fff3e0;padding:6px;border-radius:4px;text-align:center;">
            <div style="font-size:0.6rem;color:#999;">确诊</div>
            <div style="font-weight:bold;font-size:1.05rem;color:#d32f2f;">${totalConfirmed}</div>
          </div>
          <div style="flex:1;min-width:0;background:#fce4ec;padding:6px;border-radius:4px;text-align:center;">
            <div style="font-size:0.6rem;color:#999;">死亡</div>
            <div style="font-weight:bold;font-size:1.05rem;">${totalDeaths}</div>
          </div>
          <div style="flex:1;min-width:0;background:#f3e5f5;padding:6px;border-radius:4px;text-align:center;">
            <div style="font-size:0.6rem;color:#999;">CFR</div>
            <div style="font-weight:bold;font-size:1.05rem;color:${parseFloat(cfr)>5?'#d32f2f':'#333'};">${cfr}%</div>
          </div>
          <div style="flex:1;min-width:0;background:#e8eaf6;padding:6px;border-radius:4px;text-align:center;">
            <div style="font-size:0.6rem;color:#999;">含疑似</div>
            <div style="font-weight:bold;font-size:1.05rem;">${(totalConfirmed+totalSuspected)}</div>
          </div>
          <div style="flex:1;min-width:0;background:#e8f5e9;padding:6px;border-radius:4px;text-align:center;">
            <div style="font-size:0.6rem;color:#999;">疫区</div>
            <div style="font-weight:bold;font-size:1.05rem;">${regionRows.length}</div>
          </div>
        </div>

        ${demoHTML}

        <div style="flex:1;overflow-y:auto;min-height:0;">
          <table style="width:100%;border-collapse:collapse;font-size:0.72rem;">
            <thead><tr style="border-bottom:2px solid #e0e0e0;">
              <th style="text-align:left;padding:2px 4px;color:#888;font-weight:600;">区域</th>
              <th style="text-align:right;padding:2px 4px;color:#888;font-weight:600;" title="累计确诊">确诊</th>
              <th style="text-align:right;padding:2px 4px;color:#888;font-weight:600;" title="累计死亡">死亡</th>
              <th style="text-align:right;padding:2px 4px;color:#888;font-weight:600;" title="Case Fatality Rate">CFR</th>
              <th style="text-align:right;padding:2px 4px;color:#888;font-weight:600;" title="疑似病例">疑似</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>

        <div style="margin-top:4px;font-size:0.6rem;color:#bbb;border-top:1px solid #f0f0f0;padding-top:4px;">
          WHO AFRO SitReps · ${state.timeRange?state.timeRange[1]:'2026-05-24'}
          ${state.animatingDate?' · 动画: '+state.animatingDate:''}
        </div>
      </div>
    `;
  }

  function render(state) {
    if (dom) dom.innerHTML = buildHTML(state);
  }

  const unsub = store.subscribe(render);
  render(store.getState());

  return {
    render,
    resize: () => {},
    destroy: () => { unsub(); dom && (dom.innerHTML = ''); },
  };
}
