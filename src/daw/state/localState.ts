/**
 * Local UI state - client-specific, never synced to server
 * Each client maintains independent playback, recording, and UI preferences
 */

export interface LocalUIState {
  // Playback control
  playheadSeconds: number;
  isPlaying: boolean;
  
  // Recording control
  isRecording: boolean;
  armedTrackIds: Set<string>;
  
  // Client-side mixing preferences (not shared)
  muteTrackIds: Set<string>;
  soloTrackIds: Set<string>;
  
  // UI selection and view
  selectedClipId?: string;
  selectedTrackId?: string;
  scrollLeft: number;
  zoomLevel: number;
}

export type LocalUIAction = 
  | { type: 'SET_PLAYHEAD'; playheadSeconds: number }
  | { type: 'SET_PLAYING'; isPlaying: boolean }
  | { type: 'SET_RECORDING'; isRecording: boolean }
  | { type: 'TOGGLE_ARMED_TRACK'; trackId: string }
  | { type: 'SET_ARMED_TRACK'; trackId: string; armed: boolean }
  | { type: 'CLEAR_ARMED_TRACKS' }
  | { type: 'TOGGLE_LOCAL_MUTE'; trackId: string }
  | { type: 'SET_LOCAL_MUTE'; trackId: string; muted: boolean }
  | { type: 'TOGGLE_LOCAL_SOLO'; trackId: string }
  | { type: 'SET_LOCAL_SOLO'; trackId: string; soloed: boolean }
  | { type: 'SET_SELECTED_CLIP'; clipId?: string }
  | { type: 'SET_SELECTED_TRACK'; trackId?: string }
  | { type: 'SET_SCROLL'; scrollLeft: number }
  | { type: 'SET_ZOOM'; zoomLevel: number };

export function createInitialLocalUIState(): LocalUIState {
  return {
    playheadSeconds: 0,
    isPlaying: false,
    isRecording: false,
    armedTrackIds: new Set(),
    muteTrackIds: new Set(),
    soloTrackIds: new Set(),
    scrollLeft: 0,
    zoomLevel: 1,
  };
}

export function applyLocalUIAction(state: LocalUIState, action: LocalUIAction): LocalUIState {
  switch (action.type) {
    case 'SET_PLAYHEAD':
      return { ...state, playheadSeconds: action.playheadSeconds };
    
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.isPlaying };
    
    case 'SET_RECORDING':
      return { ...state, isRecording: action.isRecording };
    
    case 'TOGGLE_ARMED_TRACK': {
      const newArmed = new Set(state.armedTrackIds);
      if (newArmed.has(action.trackId)) {
        newArmed.delete(action.trackId);
      } else {
        newArmed.add(action.trackId);
      }
      return { ...state, armedTrackIds: newArmed };
    }
    
    case 'SET_ARMED_TRACK': {
      const newArmed = new Set(state.armedTrackIds);
      if (action.armed) {
        newArmed.add(action.trackId);
      } else {
        newArmed.delete(action.trackId);
      }
      return { ...state, armedTrackIds: newArmed };
    }
    
    case 'CLEAR_ARMED_TRACKS':
      return { ...state, armedTrackIds: new Set() };
    
    case 'TOGGLE_LOCAL_MUTE': {
      const newMuted = new Set(state.muteTrackIds);
      if (newMuted.has(action.trackId)) {
        newMuted.delete(action.trackId);
      } else {
        newMuted.add(action.trackId);
      }
      return { ...state, muteTrackIds: newMuted };
    }
    
    case 'SET_LOCAL_MUTE': {
      const newMuted = new Set(state.muteTrackIds);
      if (action.muted) {
        newMuted.add(action.trackId);
      } else {
        newMuted.delete(action.trackId);
      }
      return { ...state, muteTrackIds: newMuted };
    }
    
    case 'TOGGLE_LOCAL_SOLO': {
      const newSoloed = new Set(state.soloTrackIds);
      if (newSoloed.has(action.trackId)) {
        newSoloed.delete(action.trackId);
      } else {
        newSoloed.add(action.trackId);
      }
      return { ...state, soloTrackIds: newSoloed };
    }
    
    case 'SET_LOCAL_SOLO': {
      const newSoloed = new Set(state.soloTrackIds);
      if (action.soloed) {
        newSoloed.add(action.trackId);
      } else {
        newSoloed.delete(action.trackId);
      }
      return { ...state, soloTrackIds: newSoloed };
    }
    
    case 'SET_SELECTED_CLIP':
      return { ...state, selectedClipId: action.clipId };
    
    case 'SET_SELECTED_TRACK':
      return { ...state, selectedTrackId: action.trackId };
    
    case 'SET_SCROLL':
      return { ...state, scrollLeft: action.scrollLeft };
    
    case 'SET_ZOOM':
      return { ...state, zoomLevel: action.zoomLevel };
    
    default:
      return state;
  }
}
