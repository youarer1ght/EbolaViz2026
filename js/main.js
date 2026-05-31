/**
 * Application Entry Point
 * 1. Load all data
 * 2. Initialize Store
 * 3. Initialize all 5 views
 * 4. Wire up playback controls
 *
 * Choropleth mode is default (GeoJSON loaded from data/geo/outbreak_region.geojson).
 */
import { createStore, reducer, getInitialState } from './store.js';
import {
  setAnimatingDate, setIsPlaying, resetAll,
} from './actions.js';
import { loadAllData, getTimeRange } from './utils/dataLoader.js';
import { initHeatmap }  from './views/heatmapView.js';
import { initTimeline } from './views/timelineView.js';
import { initParallel } from './views/parallelView.js';
import { initPolicy }   from './views/policyView.js';
import { initDetail }   from './views/detailView.js';

async function main() {
  console.log('🦠 EbolaViz2026 — 疫情时空可视化分析系统');
  console.log('   数据: 5/14–5/28 INSP 真实数据 (159条) + 5/29–8/15 SEIR模型外推');

  // ── 1. Load data ──
  console.log('📦 Loading data...');
  const data = await loadAllData();
  const fullTimeRange = getTimeRange(data.cases);
  console.log(`   Time range: ${fullTimeRange[0]} ~ ${fullTimeRange[1]}`);
  console.log(`   Case records: ${data.cases?.length || 0}`);
  console.log(`   Regions: ${data.demographics?.length || 0}`);
  console.log(`   Policy events: ${data.policies?.length || 0}`);

  // Update data source label
  const srcEl = document.getElementById('data-source');
  if (srcEl) srcEl.textContent = `数据: 5/14–5/28 WHO INSP 真实数据 + 5/29–8/15 SEIR 模型外推`;

  // ── 2. Create Store ──
  const store = createStore(reducer, getInitialState(fullTimeRange));

  // Export to window for debugging (remove in production)
  window.__store = store;
  window.__data = data;

  // ── 3. Initialize views ──
  console.log('🎨 Initializing views...');
  const views = {
    heatmap:  initHeatmap( document.getElementById('chart-heatmap'),  store, data),
    timeline: initTimeline(document.getElementById('chart-timeline'), store, data),
    parallel: initParallel(document.getElementById('chart-parallel'), store, data),
    policy:   initPolicy(  document.getElementById('chart-policy'),   store, data),
    detail:   initDetail(  document.getElementById('chart-detail'),   store, data),
  };
  console.log('   ✓ All 5 views initialized');

  // ── 4. Playback controls ──
  let animTimer = null;
  const btnPlay  = document.getElementById('btn-play');
  const btnPause = document.getElementById('btn-pause');
  const btnReset = document.getElementById('btn-reset');
  const dateDisplay = document.getElementById('current-date');

  function getUniqueDates() {
    if (!data.cases) return [];
    return [...new Set(data.cases.map(c => c.date))].sort();
  }

  function stopAnimation() {
    if (animTimer) { clearInterval(animTimer); animTimer = null; }
  }

  btnPlay.addEventListener('click', () => {
    store.dispatch(setIsPlaying(true));
    const dates = getUniqueDates();
    let idx = 0;
    const currentDate = store.getState().animatingDate;
    if (currentDate) {
      const found = dates.indexOf(currentDate);
      idx = found >= 0 ? found : 0;
    }

    stopAnimation();
    animTimer = setInterval(() => {
      if (idx >= dates.length) {
        stopAnimation();
        store.dispatch(setIsPlaying(false));
        return;
      }
      store.dispatch(setAnimatingDate(dates[idx]));
      idx++;
    }, 800); // 800ms per date — adjust for demo speed
  });

  btnPause.addEventListener('click', () => {
    stopAnimation();
    store.dispatch(setIsPlaying(false));
  });

  btnReset.addEventListener('click', () => {
    stopAnimation();
    store.dispatch(resetAll(fullTimeRange));
  });

  // Update button states
  store.subscribe(state => {
    if (btnPlay)  btnPlay.disabled  = state.isPlaying;
    if (btnPause) btnPause.disabled = !state.isPlaying;
    if (dateDisplay) {
      dateDisplay.textContent = state.animatingDate
        ? `📍 当前: ${state.animatingDate}`
        : (state.isPlaying ? '▶ 播放中...' : '');
    }
  });

  // ── 5. Global resize handler ──
  window.addEventListener('resize', () => {
    for (const v of Object.values(views)) {
      if (v.resize) v.resize();
    }
  });

  // ── 6. Keyboard shortcuts ──
  window.addEventListener('keydown', e => {
    switch (e.key) {
      case ' ': // Space = toggle play/pause
        e.preventDefault();
        if (store.getState().isPlaying) btnPause.click();
        else btnPlay.click();
        break;
      case 'r': case 'R': // R = reset
        if (!e.ctrlKey && !e.metaKey) btnReset.click();
        break;
    }
  });

  console.log('✅ EbolaViz2026 ready.');
  console.log('   💡 空格键播放/暂停 | R键重置 | dataZoom刷选时间段 | 点击地图区域筛选');
  console.log('   🔧 调试: window.__store.getState() | window.__data');
}

document.addEventListener('DOMContentLoaded', main);
