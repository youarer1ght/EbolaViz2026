/**
 * View ①: Spatiotemporal Heatmap
 * Uses ECharts scatter/bubble map when GeoJSON is unavailable,
 * upgrades to choropleth map when team adds GeoJSON files.
 */
import { setSelectedRegions, setHighlightedRegions } from '../actions.js';
import { filterCases, summarizeByRegion } from '../utils/dataLoader.js';
import { HEATMAP, getRegionColor } from '../utils/colors.js';

// Approximate coordinates for affected health zones (for scatter fallback)
const ZONE_COORDS = {
  "Mongbalu":    [30.05, 1.72],
  "Nyakunde":    [30.10, 1.55],
  "Rwampara":    [30.15, 1.65],
  "Bunia":       [30.25, 1.56],
  "Butembo":     [29.29, 0.13],
  "Katwa":       [29.35, 0.10],
  "Goma":        [29.23, -1.68],
  "Kampala":     [32.58, 0.32],
  "Kisoro":      [29.68, -1.28],
  "Kanungu":     [29.78, -0.78],
  "Arua":        [30.91, 3.02],
  "Bundibugyo":  [30.06, 0.71],
};

export function initHeatmap(dom, store, data) {
  const chart = echarts.init(dom);
  const hasGeo = !!(data.geoDRC && data.geoUGA);

  function buildOption(state) {
    const filtered = filterCases(data.cases, state);
    const summary = summarizeByRegion(filtered);

    const maxVal = Math.max(1, ...Object.values(summary).map(s => s.totalConfirmed));

    if (hasGeo) {
      // ── Choropleth mode (when GeoJSON is available) ──
      // Register maps (team: replace with actual GeoJSON feature properties)
      // echarts.registerMap('DRC', data.geoDRC);
      // echarts.registerMap('UGA', data.geoUGA);
      return buildChoroplethOption(summary, maxVal, state);
    } else {
      // ── Bubble/scatter mode (framework fallback) ──
      return buildBubbleOption(summary, maxVal, state);
    }
  }

  function buildBubbleOption(summary, maxVal, state) {
    const bubbleData = Object.entries(summary)
      .filter(([region]) => {
        if (state.selectedRegions.length > 0) return state.selectedRegions.includes(region);
        return true;
      })
      .map(([region, s]) => {
        const coords = ZONE_COORDS[region] || [30.0 + Math.random() * 2, 1.5 + Math.random() * 2];
        const highlighted = state.highlightedRegions.includes(region);
        return {
          name: region,
          value: [...coords, s.totalConfirmed, s.totalDeaths, s.totalSuspected],
          symbolSize: Math.max(8, Math.sqrt(s.totalConfirmed) * 3),
          itemStyle: {
            color: getRegionColor(region),
            borderColor: highlighted ? '#000' : '#fff',
            borderWidth: highlighted ? 2 : 0.5,
            shadowBlur: highlighted ? 10 : 0,
          },
          label: { show: s.totalConfirmed > 0, formatter: '{b}', fontSize: 9 },
        };
      });

    return {
      backgroundColor: '#f5f7fa',
      tooltip: {
        trigger: 'item',
        formatter: p => `<b>${p.name}</b><br/>
          确诊: <b>${p.value[2]}</b> | 死亡: <b>${p.value[3]}</b><br/>
          疑似: ${p.value[4]}<br/>
          <em>📌 点击选中/取消区域 | 🖱 悬浮高亮</em>`,
      },
      grid: { top: 8, right: 16, bottom: 8, left: 16 },
      xAxis: { type: 'value', show: false, min: 28.5, max: 33.5 },
      yAxis: { type: 'value', show: false, min: -2.5, max: 3.5 },
      series: [{
        type: 'scatter',
        data: bubbleData,
        encode: { tooltip: [2, 3, 4] },
        emphasis: { scale: 1.5 },
      }],
      // Team TODO: Replace with map type once GeoJSON is added to data/geo/
    };
  }

  function buildChoroplethOption(summary, maxVal, state) {
    // Placeholder for choropleth — activate when team adds GeoJSON
    return buildBubbleOption(summary, maxVal, state);
  }

  // ── Interactions (works for both modes) ──
  chart.on('click', params => {
    if (params.componentType === 'series' && params.name) {
      const current = store.getState().selectedRegions;
      const next = current.includes(params.name)
        ? current.filter(r => r !== params.name)
        : [...current, params.name];
      store.dispatch(setSelectedRegions(next));
    }
    // Click on empty area → deselect all
    if (params.componentType === 'series' && !params.name) {
      store.dispatch(setSelectedRegions([]));
    }
  });

  chart.on('mouseover', params => {
    if (params.componentType === 'series' && params.name) {
      store.dispatch(setHighlightedRegions([params.name]));
    }
  });
  chart.on('mouseout', () => store.dispatch(setHighlightedRegions([])));

  // ── Store subscription ──
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
