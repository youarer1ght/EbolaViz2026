import { A } from './store.js';

// ── Action Creators ──
export const setTimeRange          = r => ({ type: A.SET_TIME_RANGE, payload: r });
export const setAnimatingDate      = d => ({ type: A.SET_ANIMATING_DATE, payload: d });
export const setIsPlaying          = p => ({ type: A.SET_IS_PLAYING, payload: p });
export const setSelectedRegions    = r => ({ type: A.SET_SELECTED_REGIONS, payload: r });
export const setHighlightedRegions = r => ({ type: A.SET_HIGHLIGHTED_REGIONS, payload: r });
export const setParallelAxesFilter = f => ({ type: A.SET_PARALLEL_AXES_FILTER, payload: f });
export const setSelectedPolicyIds  = ids => ({ type: A.SET_SELECTED_POLICY_IDS, payload: ids });
export const setActiveView         = v => ({ type: A.SET_ACTIVE_VIEW, payload: v });
export const resetAll              = fullTimeRange => ({ type: A.RESET_ALL, payload: { timeRange: fullTimeRange } });
