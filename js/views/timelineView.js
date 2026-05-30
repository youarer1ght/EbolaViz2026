/**
 * View ②: Timeline — multi-series line/bar chart with dataZoom.
 * dataZoom brush → dispatches SET_TIME_RANGE → all other views follow.
 */
import { setTimeRange } from '../actions.js';
import { filterCases, aggregateByRegion } from '../utils/dataLoader.js';
import { getRegionColor } from '../utils/colors.js';

export function initTimeline(dom, store, data) {
  const chart = echarts.init(dom);
  let lastZoomDispatch = 0; // throttle

  function buildOption(state) {
    const filtered = filterCases(data.cases, state);
    const byRegion = aggregateByRegion(filtered);

    const showRegions = state.selectedRegions.length > 0
      ? state.selectedRegions.filter(r => byRegion[r])
      : Object.keys(byRegion);

    const series = showRegions.map(region => ({
      name: region,
      type: 'line',
      data: (byRegion[region] || []).map(d => [d.date, d.new_cases || d.suspected_cases || 0]),
      smooth: true,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: {
        width: state.highlightedRegions.includes(region) ? 3.5 : 1.5,
      },
      itemStyle: {
        color: getRegionColor(region),
      },
      emphasis: { focus: 'series' },
    }));

    return {
      backgroundColor: '#f5f7fa',
      tooltip: {
        trigger: 'axis',
        formatter: params => {
          if (!params || params.length === 0) return '';
          return params.map(p =>
            `<span style="color:${p.color}">●</span> ${p.seriesName}: <b>${p.value[1]}</b> 例`
          ).join('<br/>');
        },
      },
      legend: {
        type: 'scroll', bottom: 0,
        textStyle: { fontSize: 9 },
        pageTextStyle: { fontSize: 9 },
      },
      grid: { top: 8, right: 16, bottom: 40, left: 48 },
      xAxis: {
        type: 'time',
        axisLabel: { fontSize: 9, rotate: 30 },
        name: '日期',
        nameTextStyle: { fontSize: 9 },
      },
      yAxis: {
        type: 'value',
        name: '病例数',
        axisLabel: { fontSize: 9 },
      },
      dataZoom: [
        { type: 'slider', start: 0, end: 100, height: 18, bottom: 20 },
        { type: 'inside' },
      ],
      series,
    };
  }

  // dataZoom → dispatch time range (throttled to ~200ms)
  chart.on('dataZoom', () => {
    const now = Date.now();
    if (now - lastZoomDispatch < 200) return;
    lastZoomDispatch = now;

    const opt = chart.getOption();
    if (opt.dataZoom && opt.dataZoom[0]) {
      const dz = opt.dataZoom[0];
      if (dz.startValue && dz.endValue) {
        store.dispatch(setTimeRange([dz.startValue, dz.endValue]));
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
