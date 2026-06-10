/**
 * View ①: Spatiotemporal Heatmap (Choropleth Map)
 *
 * Primary mode: ECharts choropleth using real ADM1 GeoJSON
 *   (geoboundaries.org → DRC 26 provinces + Uganda 4 regions)
 * Fallback mode: scatter/bubble map when GeoJSON load fails.
 *
 * Coordination:
 *   Click province → show detail panel with zone scatter markers → click individual zones to select
 *   Hover province → highlight child zones (timeline line width, etc.)
 *
 * Province detail panel (right side):
 *   When a province is clicked, a zoomed-in map of that province appears
 *   on the right with health zones shown as clickable scatter markers.
 *   This solves two problems:
 *     1. The choropleth map is tall but the container is wide — splitting
 *        gives the overview map a better aspect ratio.
 *     2. Users can now select individual health zones within a province,
 *        not just all-or-nothing.
 *
 * Design note: choropleth colors always use the FULL time-filtered dataset
 * (ignoring region selection) so unselected provinces retain their data
 * encoding and don't disappear.
 */
import { setSelectedRegions, setHighlightedRegions } from '../actions.js';
import { filterCases, summarizeByProvince, summarizeByRegion, stateKeysEqual } from '../utils/dataLoader.js';
import { getRegionColor } from '../utils/colors.js';

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

// 7-level yellow-orange-red gradient for choropleth (ColorBrewer YlOrRd 7-class)
// Log-scale mapping handles the exponential distribution of epidemic data:
// early/sporadic zones spread apart at the low end while maintaining
// differentiation between major epicenters at the high end.
const PROVINCE_COLORS = [
  '#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#f03b20', '#bd0026',
];

/** Log-scale color mapping: t = log(value+1) / log(max+1) → 7 buckets.
 *  Linear mapping would collapse 130–341 (6 provinces) into one bucket
 *  while leaving the 7k–40k range spanning 4 empty buckets.  Log scale
 *  distributes the 8 non-zero provinces across 4–5 visible colors. */
function choroplethColor(value, max) {
  if (max === 0 || value === 0) return '#f0f0f0';
  const t = Math.log(value + 1) / Math.log(max + 1);
  const idx = Math.min(6, Math.floor(t * 7));
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

/**
 * Compute approximate centroid of a GeoJSON Polygon or MultiPolygon.
 * Uses the largest ring (for MultiPolygon) and averages all vertex coordinates.
 */
function computeCentroid(geometry) {
  if (!geometry) return [0, 0];
  let coords = [];

  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0];
  } else if (geometry.type === 'MultiPolygon') {
    // Pick the largest polygon by vertex count
    let maxLen = 0;
    for (const ring of geometry.coordinates) {
      if (ring[0].length > maxLen) {
        coords = ring[0];
        maxLen = ring[0].length;
      }
    }
  }

  if (coords.length === 0) return [0, 0];
  let sumX = 0, sumY = 0;
  for (const [x, y] of coords) {
    sumX += x;
    sumY += y;
  }
  return [sumX / coords.length, sumY / coords.length];
}

// Zone marker colors (for province detail scatter)
const ZONE_MARKER_COLORS = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231',
  '#911eb4', '#42d4f4', '#f032e6', '#bfef45',
  '#fabed4', '#469990', '#dcbeff', '#9a6324',
];

function zoneMarkerColor(index) {
  return ZONE_MARKER_COLORS[index % ZONE_MARKER_COLORS.length];
}

// ══════════════════════════════════════════════════════════════════════════════

export function initHeatmap(dom, store, data) {
  const chart = echarts.init(dom);
  const hasGeo = !!(data.geoOutbreak && data.geoOutbreak.features);

  // ── Build bidirectional lookup: province ↔ zones ──
  const provinceToZones = {};   // province name → [health zone names]
  const zoneToProvince = {};    // health zone name → province name
  if (data.demographics) {
    for (const d of data.demographics) {
      const adm1 = resolveAdm1(d, data.ugaDistrictRegion);
      if (!provinceToZones[adm1]) provinceToZones[adm1] = [];
      if (!provinceToZones[adm1].includes(d.region)) {
        provinceToZones[adm1].push(d.region);
      }
      zoneToProvince[d.region] = adm1;
    }
  }

  // ── Build GeoJSON feature lookup: province name → feature ──
  const geoFeatureMap = {};
  const provinceCentroids = {};
  if (hasGeo) {
    for (const feat of data.geoOutbreak.features) {
      const name = feat.properties.name || feat.properties.shapeName;
      geoFeatureMap[name] = feat;
      provinceCentroids[name] = computeCentroid(feat.geometry);
    }
  }

  // Register merged map once
  if (hasGeo) {
    echarts.registerMap('outbreak-region', data.geoOutbreak);
  }

  // ── Province detail panel (right side) ──
  const detailDom = document.getElementById('chart-heatmap-detail');
  const detailWrapper = detailDom ? detailDom.parentElement : null;
  const detailChart = detailDom ? echarts.init(detailDom) : null;
  let activeDetailProvince = null;       // which province is shown in detail
  const registeredProvinceMaps = new Set(); // track which province maps we've registered

  // Show/hide detail panel
  function showDetailPanel(provinceName) {
    if (!detailWrapper) return;
    // Hide placeholder overlay, switch to solid border
    const placeholder = detailWrapper.querySelector('.detail-placeholder');
    if (placeholder) placeholder.style.display = 'none';
    detailWrapper.style.border = '1px solid #d0d0d0';
    detailWrapper.style.background = '#fff';
    detailChart && detailChart.resize();
  }

  function hideDetailPanel() {
    if (!detailWrapper) return;
    const placeholder = detailWrapper.querySelector('.detail-placeholder');
    if (placeholder) placeholder.style.display = '';
    detailWrapper.style.border = '1px dashed #d0d0d0';
    detailWrapper.style.background = '#f8f9fb';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Province detail option builder (zoomed map + health zone markers)
  // ═══════════════════════════════════════════════════════════════════════

  function buildProvinceDetailOption(provinceName, state) {
    if (!hasGeo || !provinceName || !detailChart) return null;

    const zones = provinceToZones[provinceName];
    if (!zones || zones.length === 0) {
      // Province has no health zones in our data — show minimal info
      return {
        backgroundColor: '#f8f9fb',
        title: {
          text: provinceName,
          subtext: '(暂无卫生区数据)',
          left: 'center', top: '40%',
          textStyle: { fontSize: 13, fontWeight: 'bold', color: '#888' },
          subtextStyle: { fontSize: 10, color: '#aaa' },
        },
      };
    }

    // Register single-province map if not already done
    const mapName = `province-${provinceName}`;
    if (!registeredProvinceMaps.has(mapName)) {
      const feature = geoFeatureMap[provinceName];
      if (feature) {
        echarts.registerMap(mapName, {
          type: 'FeatureCollection',
          features: [feature],
        });
        registeredProvinceMaps.add(mapName);
      }
    }

    // Get zone stats from unfiltered (time+animation filtered only) data
    const colorState = { ...state, selectedRegions: [], highlightedRegions: [] };
    const zoneSummary = summarizeByRegion(filterCases(data.cases, colorState));
    const activeZones = zones.filter(z => (zoneSummary[z] || {}).totalConfirmed > 0);
    const inactiveCount = zones.length - activeZones.length;
    const displayZones = activeZones.length > 0 ? activeZones : zones.slice(0, 8);
    const selectedSet = new Set(state.selectedRegions);

    // Use real geographic coordinates from INRB health zone shapefile
    const zoneCoords = data.zoneCoords || {};
    const centroid = provinceCentroids[provinceName] || [0, 0];

    const maxZoneCases = Math.max(1,
      ...displayZones.map(z => (zoneSummary[z] || {}).totalConfirmed || 0));

    const scatterData = displayZones.map((zone, i) => {
      const s = zoneSummary[zone] || { totalConfirmed: 0, totalDeaths: 0 };
      const isSelected = selectedSet.has(zone);
      // Log-scale sizing: 6–30px — keeps markers distinguishable without
      // excessive overlap even in dense provinces like Nord-Kivu
      const size = 6 + 24 * (Math.log((s.totalConfirmed || 0) + 1) / Math.log(maxZoneCases + 1));
      // Real position from shapefile centroids, fallback to province centroid
      const coord = zoneCoords[zone];
      const lon = coord ? coord.lon : centroid[0];
      const lat = coord ? coord.lat : centroid[1];
      return {
        name: zone,
        value: [lon, lat, s.totalConfirmed, s.totalDeaths, s.totalSuspected || 0],
        symbolSize: size,
        itemStyle: {
          color: isSelected ? '#ff8f00' : zoneMarkerColor(i),
          borderColor: isSelected ? '#333' : '#fff',
          borderWidth: isSelected ? 2.5 : 1,
          opacity: isSelected ? 1 : 0.75,  // unselected markers semi-transparent
          shadowBlur: isSelected ? 10 : 2,
          shadowColor: 'rgba(0,0,0,0.3)',
        },
        label: {
          show: true,
          formatter: zone,
          position: 'right',
          fontSize: isSelected ? 11 : 9,
          fontWeight: isSelected ? 'bold' : 'normal',
          color: isSelected ? '#333' : '#555',
          offset: [4, 0],
        },
        emphasis: {
          scale: 1.5,
          label: { fontSize: 11, fontWeight: 'bold' },
        },
      };
    }).reverse();  // small markers on top → always clickable even in dense clusters

    // Count how many zones are selected in this province
    const selectedZoneCount = zones.filter(z => selectedSet.has(z)).length;

    return {
      backgroundColor: '#fff',
      title: {
        text: provinceName,
        subtext: `${activeZones.length}/${zones.length} 个卫生区有病例 · ${selectedZoneCount} 已选`
          + (inactiveCount > 0 ? ` · ${inactiveCount} 个暂未受累` : ''),
        left: 'center',
        top: 6,
        textStyle: { fontSize: 12, fontWeight: 'bold', color: '#333' },
        subtextStyle: { fontSize: 9, color: '#888' },
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: p => {
          if (!p.name || p.value.length < 3) return '';
          const v = p.value;
          return `<b>${p.name}</b><br/>
            确诊: <b style="color:#d32f2f;">${v[2]}</b> | 死亡: <b>${v[3]}</b><br/>
            疑似: ${v[4] || 0}<br/>
            <em style="color:#888;">📌 点击选中/取消该卫生区</em>`;
        },
      },
      // ── Select all / clear buttons for the province detail panel ──
      // Injected as graphic elements inside the chart (reliable positioning)
      graphic: [
        { id:'btn-select-all', type:'text', left:8, top:4, z:200,
          style:{ text:'☑ 全选', fontSize:10, fill:'#555', fontFamily:'sans-serif' },
          onclick:() => {
            const zones = provinceToZones[activeDetailProvince] || [];
            const cur = store.getState().selectedRegions;
            store.dispatch(setSelectedRegions([...new Set([...cur, ...zones])]));
          } },
        { id:'btn-clear-prov', type:'text', left:60, top:4, z:200,
          style:{ text:'✕ 清除', fontSize:10, fill:'#888', fontFamily:'sans-serif' },
          onclick:() => {
            const zones = provinceToZones[activeDetailProvince] || [];
            const cur = store.getState().selectedRegions;
            store.dispatch(setSelectedRegions(cur.filter(r => !zones.includes(r))));
          } },
      ],
      geo: {
        map: mapName,
        roam: true,   // scroll-wheel zoom + drag pan to separate dense markers
        zoom: 1.0,
        center: centroid,
        aspectScale: 0.85,
        layoutCenter: ['50%', '52%'],
        layoutSize: '95%',
        label: { show: false },
        itemStyle: {
          areaColor: '#fafafa',
          borderColor: '#666',
          borderWidth: 1.5,
        },
        emphasis: {
          label: { show: false },
          itemStyle: { areaColor: '#f5f5f5' },
        },
      },
      series: [{
        id: 'detail-scatter',
        type: 'scatter',
        coordinateSystem: 'geo',
        data: scatterData,
        encode: { tooltip: [2, 3, 4] },
        labelLayout: {
          moveOverlap: 'shiftY',
        },
      }],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Option builders (overview map)
  // ═══════════════════════════════════════════════════════════════════════

  function buildOption(state) {
    if (hasGeo) return buildChoroplethOption(state);
    return buildBubbleOption(state);
  }

  /** Choropleth: map series with province-level fill encoding.
   *
   *  Uses a two-series approach to solve the shared-edge border clipping
   *  problem inherent in ECharts single-series map rendering:
   *
   *    Series 1 (base)    — All provinces, uniform thin borders.
   *                         Selection shown via fill colour + shadow.
   *    Series 2 (overlay) — Selected / partial / highlighted provinces
   *                         only.  Transparent fill, thick borders drawn
   *                         on top.  silent:true so events pass through.
   *
   *  Because the thick borders live in their own series, they are never
   *  clipped by adjacent-polygon rendering in the base layer.          */
  function buildChoroplethOption(state) {
    // For fill colors: use time+animation filter ONLY, ignore region selection
    // so unselected provinces still show their case-level color encoding.
    const colorState = { ...state, selectedRegions: [], highlightedRegions: [] };
    const colorSummary = summarizeByProvince(
      filterCases(data.cases, colorState), data.ugaDistrictRegion);

    const globalMax = Math.max(1,
      ...Object.values(colorSummary).map(s => s.totalConfirmed));

    // Determine highlighted/selected provinces (from full state)
    const selectedProvs = new Set();
    const highlightedProvs = new Set();
    for (const r of state.selectedRegions) {
      selectedProvs.add(zoneToProvince[r] || r);
    }
    for (const r of state.highlightedRegions) {
      highlightedProvs.add(zoneToProvince[r] || r);
    }

    // Single-series approach: all styling in one data array.
    // Selected/highlighted borders may be partially clipped by adjacent
    // polygons (ECharts borders are centred on edges), but the performance
    // gain (1 render pass instead of 2) eliminates drag stutter.
    const seenProvinces = new Set();
    const mapData = [];

    for (const [prov, summary] of Object.entries(colorSummary)) {
      const isSelected = selectedProvs.has(prov);
      const isHighlighted = highlightedProvs.has(prov);
      const zonesInProv = provinceToZones[prov] || [];
      const selectedZonesInProv = zonesInProv.filter(z => state.selectedRegions.includes(z));
      const isPartial = !isSelected && selectedZonesInProv.length > 0;

      mapData.push({
        name: prov,
        value: summary.totalConfirmed,
        deaths: summary.totalDeaths,
        suspected: summary.totalSuspected,
        itemStyle: {
          areaColor: isSelected ? '#ff8f00'
                     : isHighlighted ? '#ffd54f'
                     : choroplethColor(summary.totalConfirmed, globalMax),
          borderColor: isSelected ? '#222'
                       : isHighlighted ? '#444'
                       : isPartial ? '#d84315'
                       : '#d0d0d0',
          borderWidth: isSelected ? 3.5
                       : isHighlighted ? 2.5
                       : isPartial ? 2.2
                       : 0.6,
          borderType: isPartial ? 'dashed' : 'solid',
          shadowBlur: isSelected ? 16
                      : isHighlighted ? 10
                      : 0,
          shadowColor: isSelected ? 'rgba(0,0,0,0.35)'
                       : 'rgba(0,0,0,0.2)',
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
        const isHighlighted = highlightedProvs.has(name);
        mapData.push({
          name,
          value: 0, deaths: 0, suspected: 0,
          itemStyle: {
            areaColor: '#f5f5f5',
            borderColor: '#d0d0d0',
            borderWidth: 0.5,
          },
          label: { show: false },
        });
      }
    }

    return {
      backgroundColor: '#f5f7fa',
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: p => {
          if (!p.name || p.value === undefined) return '';
          return `<b>${p.name}</b><br/>
            确诊: <b>${p.value}</b> | 死亡: <b>${p.data?.deaths ?? 0}</b><br/>
            疑似: ${p.data?.suspected ?? 0}<br/>
            <em>📌 点击选中省份 → 右侧查看卫生区详情</em>`;
        },
      },
      series: [{
        id: 'map-series',
        type: 'map',
        map: 'outbreak-region',
        roam: true,
        zoom: 2.5,
        center: [29.8, 0.3],
        nameProperty: 'name',
        label: { show: true, fontSize: 8, color: '#555' },
        emphasis: {
          label: { show: true, fontSize: 11, fontWeight: 'bold' },
          itemStyle: {
            areaColor: '#ffe082',
            shadowBlur: 14,
            shadowColor: 'rgba(0,0,0,0.35)',
            borderColor: '#666',
            borderWidth: 1.5,
          },
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
  // Interactions — Overview map
  // ═══════════════════════════════════════════════════════════════════════

  // ── Drag detection: suppress hover events during ECharts native roam ──
  //     When the user drags the map, the cursor passes over different
  //     provinces, triggering mouseover → store.dispatch → 5-view re-render.
  //     This chain runs filterCases + setOption on every frame and causes
  //     visible stutter.  We detect drag via zrender and skip the dispatch.
  let _mouseDown = false;
  let _isDragging = false;
  chart.getZr().on('mousedown', () => { _mouseDown = true; _isDragging = false; });
  chart.getZr().on('mousemove', () => { if (_mouseDown) _isDragging = true; });
  chart.getZr().on('mouseup', () => { _mouseDown = false; _isDragging = false; });

  chart.on('click', params => {
    if (_isDragging) return;  // don't select after a drag
    if (hasGeo && params.componentType === 'series' && params.name) {
      const zones = provinceToZones[params.name] || [params.name];
      activeDetailProvince = params.name;

      if (zones.length > 0 && detailChart) {
        showDetailPanel(params.name);
        detailChart.setOption(buildProvinceDetailOption(params.name, store.getState()), true);
      } else {
        hideDetailPanel();
      }
      return;
    }
    if (!hasGeo && params.componentType === 'series' && params.name) {
      const current = store.getState().selectedRegions;
      const next = current.includes(params.name)
        ? current.filter(r => r !== params.name)
        : [...current, params.name];
      store.dispatch(setSelectedRegions(next));
      return;
    }
    if (params.componentType === 'series' && !params.name) {
      store.dispatch(setSelectedRegions([]));
      activeDetailProvince = null;
      hideDetailPanel();
    }
  });

  chart.on('mouseover', params => {
    if (_isDragging) return;
    if (params.componentType === 'series' && params.name) {
      const zones = provinceToZones[params.name] || [params.name];
      store.dispatch(setHighlightedRegions(zones));
    }
  });
  chart.on('mouseout', () => {
    if (_isDragging) return;
    store.dispatch(setHighlightedRegions([]));
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Interactions — Province detail (zone markers)
  // ═══════════════════════════════════════════════════════════════════════

  if (detailChart) {
    detailChart.on('click', params => {
      if (params.componentType === 'series' && params.name) {
        const current = new Set(store.getState().selectedRegions);
        if (current.has(params.name)) {
          current.delete(params.name);
        } else {
          current.add(params.name);
        }
        const next = [...current];
        store.dispatch(setSelectedRegions(next));
        // Note: detail chart will be re-rendered by the store subscription below
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Store → render
  // ═══════════════════════════════════════════════════════════════════════

  // Track previous detail province so we only do a full replace when
  // switching provinces (preserving zoom/roam within the same province).
  let _prevDetailProvince = null;

  // Viewport reset tracking: the store's _resetId increments on every
  // RESET_ALL dispatch (R key / ↺ button).  We detect the change and
  // reset zoom/center to the outbreak-focused initial viewport.
  // This works even when the user has no selections — _resetId changes
  // guarantee the render function is called and we can detect the reset.
  let _prevResetId = -1;
  let _needsViewportReset = true; // first render = reset to initial viewport

  const _HEATMAP_KEYS = ['timeRange', 'animatingDate', 'selectedRegions', 'highlightedRegions', 'selectedPolicyIds', '_resetId'];
  let _lastRendered = null;

  function render(state) {
    // Skip re-render if relevant state hasn't changed (e.g. isPlaying toggle)
    if (_lastRendered && stateKeysEqual(_lastRendered, state, _HEATMAP_KEYS)) return;
    _lastRendered = { timeRange: state.timeRange, animatingDate: state.animatingDate, selectedRegions: state.selectedRegions, highlightedRegions: state.highlightedRegions, selectedPolicyIds: state.selectedPolicyIds, _resetId: state._resetId };

    // Detect RESET_ALL via _resetId increment (always changes, even on no-op resets)
    const resetId = state._resetId || 0;
    if (resetId !== _prevResetId && _prevResetId !== -1) {
      _needsViewportReset = true;
    }
    _prevResetId = resetId;

    // ── Overview map ──
    const ovOpt = buildOption(state);

    if (_needsViewportReset) {
      chart.setOption(ovOpt, true);
      chart.setOption({
        series: [{ id: 'map-series', zoom: 2.5, center: [29.8, 0.3] }],
      });
      _needsViewportReset = false;
    } else {
      // Full replace — avoids stale-series bug that replaceMerge causes.
      // Preserve user's current zoom/center by reading before replace.
      const curOpt = chart.getOption();
      const curSer = (curOpt.series || []).find(s => s.id === 'map-series') || {};
      const curZoom = curSer.zoom;
      const curCenter = curSer.center;

      chart.setOption(ovOpt, true);

      if (curZoom != null) {
        chart.setOption({
          series: [{ id: 'map-series', zoom: curZoom, center: curCenter }],
        });
      }
    }

    // ── Auto-derive best province from current selection ──
    // Always recompute so cross-view selections (detail bar, parallel,
    // timeline) switch the right panel to the most relevant province.
    if (state.selectedRegions.length > 0 && detailChart) {
      const provVotes = {};
      for (const r of state.selectedRegions) {
        const prov = zoneToProvince[r];
        if (prov) provVotes[prov] = (provVotes[prov] || 0) + 1;
      }
      let bestProv = null, bestCount = 0;
      for (const [prov, count] of Object.entries(provVotes)) {
        if (count > bestCount) { bestProv = prov; bestCount = count; }
      }
      if (bestProv) activeDetailProvince = bestProv;
    }

    // ── Render province detail panel ──
    if (detailChart && activeDetailProvince) {
      const zones = provinceToZones[activeDetailProvince];
      if (zones && zones.length > 0) {
        showDetailPanel(activeDetailProvince);
        const detailOpt = buildProvinceDetailOption(activeDetailProvince, state);
        if (!detailOpt) { /* bubble fallback: no geo → skip detail render */ }
        else if (_prevDetailProvince !== activeDetailProvince) {
          detailChart.setOption(detailOpt, true);
        } else {
          // Same province → full replace to sync scatter marker selection
          // state.  Preserve zoom/roam by reading before replace.
          const curDetailOpt = detailChart.getOption();
          const curGeo = (curDetailOpt || {}).geo || {};
          const curDetailZoom = curGeo.zoom;
          const curDetailCenter = curGeo.center;

          detailChart.setOption(detailOpt, true);

          if (curDetailZoom != null) {
            detailChart.setOption({
              geo: { zoom: curDetailZoom, center: curDetailCenter },
            });
          }
        }
        _prevDetailProvince = activeDetailProvince;
      } else {
        hideDetailPanel();
      }
    } else if (detailChart && !activeDetailProvince) {
      _prevDetailProvince = null;
      hideDetailPanel();
      detailChart.setOption({
        backgroundColor: '#fff',
        title: { text: '', left: 'center', top: '40%' },
        geo: undefined,
        series: [],
      }, true);
    }
  }

  const unsub = store.subscribe(render);
  render(store.getState());

  // Resize handler for both charts
  function resize() {
    chart.resize();
    if (detailChart) {
      try { detailChart.resize(); } catch (e) { /* may fail if hidden */ }
    }
  }

  return {
    render,
    resize,
    destroy: () => {
      unsub();
      chart.dispose();
      if (detailChart) detailChart.dispose();
    },
  };
}
