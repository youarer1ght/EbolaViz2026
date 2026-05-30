/**
 * View ⑤: Detail Panel — aggregate statistics and regional breakdown.
 * Pure HTML rendering (no ECharts).
 */
import { filterCases, summarizeByRegion } from '../utils/dataLoader.js';

export function initDetail(dom, store, data) {

  function buildHTML(state) {
    const filtered = filterCases(data.cases, state);
    const summary = summarizeByRegion(filtered);

    // Aggregate totals
    let totalConfirmed = 0, totalDeaths = 0, totalSuspected = 0, totalSuspectedDeaths = 0;
    const regionRows = Object.values(summary)
      .sort((a, b) => b.totalConfirmed - a.totalConfirmed);

    for (const s of regionRows) {
      totalConfirmed += s.totalConfirmed;
      totalDeaths += s.totalDeaths;
      totalSuspected += s.totalSuspected;
      totalSuspectedDeaths += s.totalSuspectedDeaths;
    }
    const cfr = totalConfirmed > 0 ? (totalDeaths / totalConfirmed * 100).toFixed(1) : '0.0';

    // State description
    const regionInfo = state.selectedRegions.length > 0
      ? `<span style="color:#d32f2f;">${state.selectedRegions.join(', ')}</span>`
      : '<span style="color:#666;">全部区域</span>';
    const timeInfo = state.timeRange
      ? `${state.timeRange[0]} ~ ${state.timeRange[1]}`
      : '全部时段';
    const policyInfo = state.selectedPolicyIds.length > 0
      ? state.selectedPolicyIds.map(pid => {
          const p = (data.policies || []).find(ev => ev.id === pid);
          return p ? p.title : pid;
        }).join('; ')
      : '无';

    // Region table rows
    const maxCases = Math.max(1, ...regionRows.map(r => r.totalConfirmed));
    const tableRows = regionRows.slice(0, 10).map(r => {
      const rCFR = r.totalConfirmed > 0 ? (r.totalDeaths / r.totalConfirmed * 100).toFixed(1) : '0.0';
      const intensity = r.totalConfirmed / maxCases;
      return `
        <tr>
          <td>${r.region} <span style="color:#888;font-size:0.7rem;">${r.country}</span></td>
          <td style="color:${intensity > 0.5 ? '#d32f2f' : '#333'};font-weight:${intensity > 0.5 ? 'bold' : 'normal'}">${r.totalConfirmed}</td>
          <td>${r.totalDeaths}</td>
          <td>${rCFR}%</td>
          <td style="font-size:0.65rem;color:#888;">${r.totalSuspected}疑似</td>
        </tr>`;
    }).join('');

    return `
      <div style="padding:4px 8px;font-size:0.78rem;line-height:1.8;overflow-y:auto;height:100%;">
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:6px;">
          <div><span class="stat-label">已选区域:</span> ${regionInfo}</div>
          <div><span class="stat-label">时段:</span> ${timeInfo}</div>
          <div><span class="stat-label">选中政策:</span> ${policyInfo}</div>
        </div>

        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;">
          <div style="flex:1;min-width:80px;background:#fff3e0;padding:6px;border-radius:4px;text-align:center;">
            <div style="font-size:0.65rem;color:#888;">确诊</div>
            <div class="stat-value" style="color:#d32f2f;">${totalConfirmed.toLocaleString()}</div>
          </div>
          <div style="flex:1;min-width:80px;background:#fce4ec;padding:6px;border-radius:4px;text-align:center;">
            <div style="font-size:0.65rem;color:#888;">确诊死亡</div>
            <div class="stat-value">${totalDeaths.toLocaleString()}</div>
          </div>
          <div style="flex:1;min-width:80px;background:#f3e5f5;padding:6px;border-radius:4px;text-align:center;">
            <div style="font-size:0.65rem;color:#888;">病死率(CFR)</div>
            <div class="stat-value" style="color:#e31a1c;">${cfr}%</div>
          </div>
          <div style="flex:1;min-width:80px;background:#e8eaf6;padding:6px;border-radius:4px;text-align:center;">
            <div style="font-size:0.65rem;color:#888;">疑似(含)</div>
            <div class="stat-value">${(totalConfirmed+totalSuspected).toLocaleString()}</div>
          </div>
        </div>

        <table>
          <thead><tr>
            <th>区域</th><th>确诊</th><th>死亡</th><th>CFR</th><th>疑似</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>

        <div style="margin-top:6px;font-size:0.65rem;color:#aaa;">
          数据来源: WHO AFRO SitReps | 更新时间: 2026-05-24
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
