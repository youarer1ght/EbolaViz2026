/**
 * Minimal observable store — ~80 lines, zero dependencies.
 *
 *   const store = createStore(reducer, initialState);
 *   store.dispatch({ type: 'SET_TIME_RANGE', payload: [...] });
 *   const state = store.getState();
 *   const unsub = store.subscribe((newState) => { ... });
 */
export function createStore(reducer, initialState) {
  let state = initialState;
  const listeners = new Set();

  function getState() { return state; }

  function dispatch(action) {
    const nextState = reducer(state, action);
    if (nextState === state) return; // no change
    state = nextState;
    for (const fn of listeners) fn(state);
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { getState, dispatch, subscribe };
}

// ── Action Types ──
export const A = {
  SET_TIME_RANGE:          'SET_TIME_RANGE',
  SET_ANIMATING_DATE:      'SET_ANIMATING_DATE',
  SET_IS_PLAYING:          'SET_IS_PLAYING',
  SET_SELECTED_REGIONS:    'SET_SELECTED_REGIONS',
  SET_HIGHLIGHTED_REGIONS: 'SET_HIGHLIGHTED_REGIONS',
  SET_SELECTED_POLICY_IDS: 'SET_SELECTED_POLICY_IDS',
  RESET_ALL:               'RESET_ALL',
};

// ── Reducer ──
export function reducer(state, action) {
  switch (action.type) {
    case A.SET_TIME_RANGE:
      return { ...state, timeRange: action.payload };
    case A.SET_ANIMATING_DATE:
      return { ...state, animatingDate: action.payload };
    case A.SET_IS_PLAYING:
      return { ...state, isPlaying: action.payload };
    case A.SET_SELECTED_REGIONS:
      return { ...state, selectedRegions: action.payload };
    case A.SET_HIGHLIGHTED_REGIONS:
      return { ...state, highlightedRegions: action.payload };
    case A.SET_SELECTED_POLICY_IDS:
      return { ...state, selectedPolicyIds: action.payload };
    case A.RESET_ALL:
      return { ...state,
        timeRange: action.payload.timeRange,
        animatingDate: null,
        isPlaying: false,
        selectedRegions: [],
        highlightedRegions: [],
        selectedPolicyIds: [],
      };
    default: return state;
  }
}

// ── Initial State ──
export function getInitialState(fullTimeRange) {
  return {
    timeRange: fullTimeRange,
    animatingDate: null,
    isPlaying: false,
    selectedRegions: [],
    highlightedRegions: [],
    selectedPolicyIds: [],
  };
}
