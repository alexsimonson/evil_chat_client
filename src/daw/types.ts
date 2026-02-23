/**
 * Core DAW types for collaborative timeline editing
 */

export type TrackType = 'audio' | 'midi';

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  mute: boolean;
  solo: boolean;
  volume: number; // 0-1
  armed: boolean; // ready for recording
  sortOrder: number;
}

export interface AudioAsset {
  id: string;
  projectId: string;
  url: string;
  duration: number; // seconds
  name: string;
}

export interface AudioClip {
  id: string;
  trackId: string;
  assetId: string;
  start: number; // seconds in timeline
  duration: number; // seconds
  gain: number; // 0-1
  offset: number; // start position within the asset (for trimming)
}

export interface MidiNote {
  id: string;
  time: number; // seconds from clip start
  duration: number; // seconds
  midi: number; // 0-127
  velocity: number; // 0-127
}

export interface MidiClip {
  id: string;
  trackId: string;
  start: number; // seconds in timeline
  duration: number; // seconds
  notes: MidiNote[];
}

export interface Transport {
  bpm: number;
  isPlaying: boolean;
  isRecording: boolean;
  positionSeconds: number;
  startedAtWallClock?: number; // timestamp when playback started
  hostClientId?: string; // who is the authoritative transport host
}

export interface DawState {
  projectId: string;
  version: number; // op version for sync
  tracks: Record<string, Track>;
  audioAssets: Record<string, AudioAsset>;
  audioClips: Record<string, AudioClip>;
  midiClips: Record<string, MidiClip>;
  transport: Transport;
  trackOrder: string[]; // ordered track IDs
}

// UI state (not synced)
export interface UiState {
  selectedTrackId: string | null;
  selectedClipId: string | null;
  selectedClipType: 'audio' | 'midi' | null;
  editingMidiClipId: string | null; // piano roll is open
  zoom: number; // pixels per second
  scrollLeft: number; // pixels
}

export function createEmptyDawState(projectId: string): DawState {
  return {
    projectId,
    version: 0,
    tracks: {},
    audioAssets: {},
    audioClips: {},
    midiClips: {},
    trackOrder: [],
    transport: {
      bpm: 120,
      isPlaying: false,
      isRecording: false,
      positionSeconds: 0,
    },
  };
}

export function createDefaultUiState(): UiState {
  return {
    selectedTrackId: null,
    selectedClipId: null,
    selectedClipType: null,
    editingMidiClipId: null,
    zoom: 50, // 50 pixels per second
    scrollLeft: 0,
  };
}
