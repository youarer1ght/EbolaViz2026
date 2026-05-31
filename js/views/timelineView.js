/**
 * View ②: Timeline — multi-series line chart with dataZoom.
 * dataZoom brush → dispatches SET_TIME_RANGE → all other views follow.
 *
 * Two modes (toggle via header button):
 *   Detail: one line per region (default)
 *   Overview: single aggregate line = sum of all visible regions
 */
import { setTimeRange } from '../actions.js';
import { filterCases, aggregateByRegion, getTimeRange } from '../utils/dataLoader.js';
import { getRegionColor } from '../utils/colors.js';

export function initTimeline(dom, store, data) {
  const chart = echarts.init(dom);
  let overviewMode = false;  // false=detail lines, true=aggregate sum

  // Wheel events are handled by CSS overscroll-behavior on the container.
  // No JS wheel interception needed — ECharts inside-dataZoom consumes
  // wheel events on its canvas; CSS prevents the page from also scrolling.

  // ── Toggle button ──
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = '📊 概览';
  toggleBtn.title = '切换概览/细则模式';
  Object.assign(toggleBtn.style, {
    position:'absolute', top:'4px', right:'10px', zIndex:'10',
    padding:'2px 8px', fontSize:'10px', cursor:'pointer',
    border:'1px solid #ccc', borderRadius:'3px', background:'#fff', color:'#555',
  });
  dom.style.position = 'relative';
  dom.appendChild(toggleBtn);

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    overviewMode = !overviewMode;
    toggleBtn.textContent = overviewMode ? '📊 细则' : '📊 概览';
    toggleBtn.style.background = overviewMode ? '#e3f2fd' : '#fff';
    render(store.getState());
  });

  // Track whether we need to reset dataZoom (e.g. on RESET_ALL)
  let needsReset = true;
  function buildOption(state) {
    const filtered = filterCases(data.cases, state);
    const byRegion = aggregateByRegion(filtered);

    const allRegions = state.selectedRegions.length > 0
      ? state.selectedRegions.filter(r => byRegion[r])
      : Object.keys(byRegion);

    let series;

    if (overviewMode) {
      // ── Overview: single aggregate line ──
      const dateMap = {};
      for (const region of allRegions) {
        for (const d of (byRegion[region] || [])) {
          const val = d.new_cases || d.suspected_cases || 0;
          dateMap[d.date] = (dateMap[d.date] || 0) + val;
        }
      }
      const aggData = Object.entries(dateMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, val]) => [date, val]);

      series = [{
        name: '全部区域合计',
        type: 'line',
        data: aggData,
        smooth: true,
        symbol: 'circle', symbolSize: 5,
        lineStyle: { width: 2.5, color: '#d32f2f' },
        itemStyle: { color: '#d32f2f' },
        areaStyle: { color: 'rgba(211,47,47,0.06)' },
      }];
    } else {
      // ── Detail: one line per region ──
      series = allRegions.map(region => ({
        name: region,
        type: 'line',
        data: (byRegion[region] || []).map(d => [d.date, d.new_cases || d.suspected_cases || 0]),
        smooth: true,
        symbol: 'circle', symbolSize: 4,
        lineStyle: {
          width: state.highlightedRegions.includes(region) ? 3.5 : 1.5,
        },
        itemStyle: { color: getRegionColor(region) },
        emphasis: { focus: 'series' },
      }));
    }

    // Only show legend in detail mode
    const legend = overviewMode ? { show: false } : {
      type: 'scroll', bottom: 32,
      textStyle: { fontSize: 9 },
      pageTextStyle: { fontSize: 9 },
      itemGap: 6,
    };

    // DO NOT include start/end in dataZoom config — ECharts manages
    // slider position internally. Including {start:0,end:100} in every
    // render creates a feedback loop: drag → dispatch → render →
    // slider snaps back to full range.
    // Match grid margins so slider labels don't overflow the container
    const dzConfig = [{ type: 'slider', height: 18, bottom: 8, left: 48, right: 16 }, { type: 'inside' }];

    // On RESET_ALL: force dataZoom back to full range
    if (needsReset) {
      dzConfig[0].start = 0;
      dzConfig[0].end = 100;
      needsReset = false;
    }

    return {
      backgroundColor: '#f5f7fa',
      tooltip: {
        trigger: 'axis',
        formatter: params => {
          if (!params || params.length === 0) return '';
          if (overviewMode) {
            const p = params[0];
            return `<b>${p.value[0]}</b><br/>合计: <b style="color:#d32f2f;">${p.value[1]}</b> 例`;
          }
          return params.map(p =>
            `<span style="color:${p.color}">●</span> ${p.seriesName}: <b>${p.value[1]}</b> 例`
          ).join('<br/>');
        },
      },
      legend,
      grid: { top: 8, right: 16, bottom: 65, left: 48 },
      xAxis: {
        type: 'time',
        axisLabel: { fontSize: 9, rotate: 30 },
        name: '日期',
        nameTextStyle: { fontSize: 9 },
      },
      yAxis: {
        type: 'value',
        name: overviewMode ? '合计病例数' : '病例数',
        axisLabel: { fontSize: 9 },
        nameTextStyle: { fontSize: 10, fontWeight: 'bold' },
      },
      dataZoom: dzConfig,
      series,
    };
  }

  // dataZoom → dispatch time range (debounced)
  // During rapid slider drag, ECharts fires dataZoom at ~60 fps.
  // Dispatching on every frame floods all 5 views with re-renders.
  // Debounce: only dispatch after the user pauses or stops dragging.
  let zoomDebounce = null;
  chart.on('dataZoom', (params) => {
    if (zoomDebounce) clearTimeout(zoomDebounce);
    zoomDebounce = setTimeout(() => {
      if (params.batch && params.batch[0]) {
        const b = params.batch[0];
        if (b.startValue != null && b.endValue != null) {
          store.dispatch(setTimeRange([b.startValue, b.endValue]));
        }
      }
    }, 250);  // wait 250ms after last drag event before dispatching
  });

  const fullTimeRange = getTimeRange(data.cases);
  // Track previous state to avoid full series rebuild on hover-only changes
  let prevSelKey = '';
  let prevTimeKey = '';

  function render(state) {
    // Detect RESET_ALL
    if (state.timeRange[0] === fullTimeRange[0] && state.timeRange[1] === fullTimeRange[1]) {
      needsReset = true;
    }
    // Only use replaceMerge when series actually change (selection/time).
    // Hover only changes lineStyle.width — merge is sufficient and avoids
    // destroying/recreating all series on every mouse move.
    const selKey = state.selectedRegions.sort().join(',');
    const timeKey = (state.timeRange || []).join('~');
    const structuralChange = selKey !== prevSelKey || timeKey !== prevTimeKey;
    prevSelKey = selKey;
    prevTimeKey = timeKey;

    chart.setOption(buildOption(state),
      structuralChange
        ? { notMerge: false, replaceMerge: ['series'] }
        : false  // merge only — no series destroyed, just line width updated
    );
  }

  const unsub = store.subscribe(render);
  render(store.getState());

  return {
    render,
    resize: () => chart.resize(),
    destroy: () => { unsub(); chart.dispose(); toggleBtn.remove(); },
  };
}
