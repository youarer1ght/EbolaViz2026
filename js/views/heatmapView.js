/**
 * View ①: Spatiotemporal Heatmap (Choropleth Map)
 *
 * Primary mode: ECharts choropleth using real ADM1 GeoJSON
 *   (geoboundaries.org → DRC 26 provinces + Uganda 4 regions)
 * Fallback mode: scatter/bubble map when GeoJSON load fails.
 *
 * Coordination:
 *   Click province → select all child health zones → other views filter
 *   Hover province → highlight child zones (timeline line width, etc.)
 *
 * Data flow:
 *   Health zone cases → aggregate to ADM1 province → choropleth color
 */
import { setSelectedRegions, setHighlightedRegions } from '../actions.js';
import { filterCases, summarizeByProvince, summarizeByRegion } from '../utils/dataLoader.js';
import { HEATMAP, getRegionColor } from '../utils/colors.js';

// Approximate health zone coordinates (for scatter/bubble fallback)
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

// 5-level yellow-orange-red gradient for choropleth
const PROVINCE_COLORS = ['#ffffcc', '#ffeda0', '#feb24c', '#f03b20', '#bd0026'];

function choroplethColor(value, max) {
  if (max === 0 || value === 0) return '#f0f0f0';
  const idx = Math.min(4, Math.floor((value / max) * 5));
  return PROVINCE_COLORS[Math.max(0, idx)];
}

// ── Helpers ──

/** Resolve health zone/demographic → ADM1 province name. */
function resolveAdm1(d, ugaMap) {
  if (d.country === 'UGA' && ugaMap && ugaMap[d.region]) {
    return ugaMap[d.region];
  }
  return d.province || d.region;
}

/** Quick country lookup from region name (used when only region string available). */
const UGA_REGIONS = new Set(['Kampala', 'Kisoro', 'Kanungu', 'Arua', 'Bundibugyo']);
function countryOf(region) { return UGA_REGIONS.has(region) ? 'UGA' : 'COD'; }

// ══════════════════════════════════════════════════════════════════════════════

export function initHeatmap(dom, store, data) {
  const chart = echarts.init(dom);
  const hasGeo = !!(data.geoOutbreak && data.geoOutbreak.features);

  // ── Build province → [health zones] lookup (for click→select mapping) ──
  const provinceToZones = {};
  if (data.demographics) {
    for (const d of data.demographics) {
      const adm1 = resolveAdm1(d, data.ugaDistrictRegion);
      if (!provinceToZones[adm1]) provinceToZones[adm1] = [];
      if (!provinceToZones[adm1].includes(d.region)) {
        provinceToZones[adm1].push(d.region);
      }
    }
  }

  // Register merged map once
  if (hasGeo) {
    echarts.registerMap('outbreak-region', data.geoOutbreak);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Option builders
  // ═══════════════════════════════════════════════════════════════════════

  /** Dispatch to choropleth or bubble mode. */
  function buildOption(state) {
    if (hasGeo) return buildChoroplethOption(state);
    return buildBubbleOption(state);
  }

  /** Choropleth: map series with province-level fill encoding. */
  function buildChoroplethOption(state) {
    const filtered = filterCases(data.cases, state);
    const provinceSummary = summarizeByProvince(filtered, data.ugaDistrictRegion);

    const maxVal = Math.max(1,
      ...Object.values(provinceSummary).map(s => s.totalConfirmed));

    // Determine which provinces are selected / highlighted
    const selectedProvs = new Set();
    const highlightedProvs = new Set();
    for (const r of state.selectedRegions) {
      selectedProvs.add(resolveAdm1({ region: r, country: countryOf(r) }, data.ugaDistrictRegion));
    }
    for (const r of state.highlightedRegions) {
      highlightedProvs.add(resolveAdm1({ region: r, country: countryOf(r) }, data.ugaDistrictRegion));
    }

    // Build map data array (one entry per GeoJSON feature)
    const seenProvinces = new Set();
    const mapData = [];
    for (const [prov, summary] of Object.entries(provinceSummary)) {
      const isSelected = selectedProvs.has(prov);
      const isHighlighted = highlightedProvs.has(prov);
      mapData.push({
        name: prov,
        value: summary.totalConfirmed,
        deaths: summary.totalDeaths,
        suspected: summary.totalSuspected,
        itemStyle: {
          areaColor: isSelected ? '#ff8f00'
                     : isHighlighted ? '#ffd54f'
                     : choroplethColor(summary.totalConfirmed, maxVal),
          borderColor: (isSelected || isHighlighted) ? '#333' : '#aaa',
          borderWidth: (isSelected || isHighlighted) ? 2 : 0.5,
          shadowBlur: (isSelected || isHighlighted) ? 12 : 0,
          shadowColor: 'rgba(0,0,0,0.3)',
        },
        label: {
          show: summary.totalConfirmed > 0 || isSelected,
          fontSize: isSelected ? 10 : 8,
          fontWeight: isSelected ? 'bold' : 'normal',
        },
      });
      seenProvinces.add(prov);
    }

    // Zero-case provinces (still shown on map as light gray)
    for (const feat of data.geoOutbreak.features) {
      const name = feat.properties.name || feat.properties.shapeName;
      if (!seenProvinces.has(name)) {
        mapData.push({
          name,
          value: 0,
          deaths: 0,
          suspected: 0,
          itemStyle: { areaColor: '#f5f5f5', borderColor: '#ccc', borderWidth: 0.5 },
          label: { show: false },
        });
      }
    }

    return {
      backgroundColor: '#f5f7fa',
      tooltip: {
        trigger: 'item',
        formatter: p => {
          if (!p.name || p.value === undefined) return '';
          return `<b>${p.name}</b><br/>
            确诊: <b>${p.value}</b> | 死亡: <b>${p.data?.deaths ?? 0}</b><br/>
            疑似: ${p.data?.suspected ?? 0}<br/>
            <em>📌 点击选中/取消区域 | 🖱 悬浮高亮</em>`;
        },
      },
      series: [{
        type: 'map',
        map: 'outbreak-region',
        roam: true,
        zoom: 1.3,
        center: [29.8, 0.8],
        nameProperty: 'name',
        label: { show: true, fontSize: 8, color: '#555' },
        emphasis: {
          label: { show: true, fontSize: 11, fontWeight: 'bold' },
          itemStyle: { areaColor: '#ffe082', shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.3)' },
        },
        selectedMode: false,
        data: mapData,
      }],
    };
  }

  /** Bubble/scatter fallback (when GeoJSON unavailable). */
  function buildBubbleOption(state) {
    const filtered = filterCases(data.cases, state);
    const summary = summarizeByRegion(filtered);
    const maxVal = Math.max(1, ...Object.values(summary).map(s => s.totalConfirmed));

    const bubbleData = Object.entries(summary)
      .filter(([region]) => {
        if (state.selectedRegions.length > 0) return state.selectedRegions.includes(region);
        return true;
      })
      .map(([region, s]) => {
        const coords = ZONE_COORDS[region]
          || [30.0 + Math.random() * 2, 1.5 + Math.random() * 2];
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
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Interactions
  // ═══════════════════════════════════════════════════════════════════════

  chart.on('click', params => {
    // Choropleth: province click → select all child health zones
    if (hasGeo && params.componentType === 'series' && params.name) {
      const zones = provinceToZones[params.name] || [params.name];
      const current = store.getState().selectedRegions;
      const allSelected = zones.every(z => current.includes(z));
      const next = allSelected
        ? current.filter(r => !zones.includes(r))
        : [...new Set([...current, ...zones])];
      store.dispatch(setSelectedRegions(next));
      return;
    }
    // Bubble fallback: health zone click
    if (!hasGeo && params.componentType === 'series' && params.name) {
      const current = store.getState().selectedRegions;
      const next = current.includes(params.name)
        ? current.filter(r => r !== params.name)
        : [...current, params.name];
      store.dispatch(setSelectedRegions(next));
      return;
    }
    // Click empty area → deselect all
    if (params.componentType === 'series' && !params.name) {
      store.dispatch(setSelectedRegions([]));
    }
  });

  // Hover → highlight child zones
  chart.on('mouseover', params => {
    if (params.componentType === 'series' && params.name) {
      const zones = provinceToZones[params.name] || [params.name];
      store.dispatch(setHighlightedRegions(zones));
    }
  });
  chart.on('mouseout', () => store.dispatch(setHighlightedRegions([])));

  // ═══════════════════════════════════════════════════════════════════════
  // Store → render
  // ═══════════════════════════════════════════════════════════════════════

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
