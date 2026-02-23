/**
 * DAW state reducer - applies operations deterministically
 */

import type { DawState, Track, AudioAsset, AudioClip, MidiClip, MidiNote } from '../types';
import type { DawOp } from './ops';

/**
 * Apply an operation to the state and return new state.
 * This function must be deterministic - same state + same op = same result.
 */
export function applyOp(state: DawState, op: DawOp): DawState {
  // Create a shallow copy for immutability
  const newState = { ...state };

  switch (op.type) {
    // Track operations
    case 'TRACK_ADD': {
      const track: Track = {
        id: op.trackId,
        type: op.trackType,
        name: op.name,
        volume: 0.8,
        sortOrder: op.sortOrder,
      };
      newState.tracks = { ...newState.tracks, [op.trackId]: track };
      newState.trackOrder = [...newState.trackOrder, op.trackId];
      break;
    }

    case 'TRACK_REMOVE': {
      const { [op.trackId]: removed, ...remainingTracks } = newState.tracks;
      newState.tracks = remainingTracks;
      newState.trackOrder = newState.trackOrder.filter((id) => id !== op.trackId);
      
      // Remove all clips on this track
      newState.audioClips = Object.fromEntries(
        Object.entries(newState.audioClips).filter(([_, clip]) => clip.trackId !== op.trackId)
      );
      newState.midiClips = Object.fromEntries(
        Object.entries(newState.midiClips).filter(([_, clip]) => clip.trackId !== op.trackId)
      );
      break;
    }

    case 'TRACK_RENAME': {
      if (newState.tracks[op.trackId]) {
        newState.tracks = {
          ...newState.tracks,
          [op.trackId]: { ...newState.tracks[op.trackId], name: op.name },
        };
      }
      break;
    }

    case 'TRACK_SET_VOLUME': {
      if (newState.tracks[op.trackId]) {
        newState.tracks = {
          ...newState.tracks,
          [op.trackId]: { ...newState.tracks[op.trackId], volume: op.volume },
        };
      }
      break;
    }

    // Audio asset operations
    case 'AUDIO_ASSET_ADD': {
      const asset: AudioAsset = {
        id: op.assetId,
        projectId: state.projectId,
        url: op.url,
        duration: op.duration,
        name: op.name,
      };
      newState.audioAssets = { ...newState.audioAssets, [op.assetId]: asset };
      break;
    }

    // Audio clip operations
    case 'AUDIO_CLIP_ADD': {
      const clip: AudioClip = {
        id: op.clipId,
        trackId: op.trackId,
        assetId: op.assetId,
        start: op.start,
        duration: op.duration,
        gain: op.gain,
        offset: op.offset,
      };
      newState.audioClips = { ...newState.audioClips, [op.clipId]: clip };
      break;
    }

    case 'AUDIO_CLIP_MOVE': {
      if (newState.audioClips[op.clipId]) {
        newState.audioClips = {
          ...newState.audioClips,
          [op.clipId]: {
            ...newState.audioClips[op.clipId],
            start: op.start,
            trackId: op.trackId ?? newState.audioClips[op.clipId].trackId,
          },
        };
      }
      break;
    }

    case 'AUDIO_CLIP_RESIZE': {
      if (newState.audioClips[op.clipId]) {
        newState.audioClips = {
          ...newState.audioClips,
          [op.clipId]: {
            ...newState.audioClips[op.clipId],
            duration: op.duration,
            offset: op.offset ?? newState.audioClips[op.clipId].offset,
          },
        };
      }
      break;
    }

    case 'AUDIO_CLIP_DELETE': {
      const { [op.clipId]: removed, ...remainingClips } = newState.audioClips;
      newState.audioClips = remainingClips;
      break;
    }

    // MIDI clip operations
    case 'MIDI_CLIP_ADD': {
      const clip: MidiClip = {
        id: op.clipId,
        trackId: op.trackId,
        start: op.start,
        duration: op.duration,
        notes: [],
      };
      newState.midiClips = { ...newState.midiClips, [op.clipId]: clip };
      break;
    }

    case 'MIDI_CLIP_MOVE': {
      if (newState.midiClips[op.clipId]) {
        newState.midiClips = {
          ...newState.midiClips,
          [op.clipId]: {
            ...newState.midiClips[op.clipId],
            start: op.start,
            trackId: op.trackId ?? newState.midiClips[op.clipId].trackId,
          },
        };
      }
      break;
    }

    case 'MIDI_CLIP_RESIZE': {
      if (newState.midiClips[op.clipId]) {
        newState.midiClips = {
          ...newState.midiClips,
          [op.clipId]: {
            ...newState.midiClips[op.clipId],
            duration: op.duration,
          },
        };
      }
      break;
    }

    case 'MIDI_CLIP_DELETE': {
      const { [op.clipId]: removed, ...remainingClips } = newState.midiClips;
      newState.midiClips = remainingClips;
      break;
    }

    // MIDI note operations
    case 'MIDI_NOTE_ADD': {
      if (newState.midiClips[op.clipId]) {
        const note: MidiNote = {
          id: op.noteId,
          time: op.time,
          duration: op.duration,
          midi: op.midi,
          velocity: op.velocity,
        };
        newState.midiClips = {
          ...newState.midiClips,
          [op.clipId]: {
            ...newState.midiClips[op.clipId],
            notes: [...newState.midiClips[op.clipId].notes, note],
          },
        };
      }
      break;
    }

    case 'MIDI_NOTE_MOVE': {
      if (newState.midiClips[op.clipId]) {
        newState.midiClips = {
          ...newState.midiClips,
          [op.clipId]: {
            ...newState.midiClips[op.clipId],
            notes: newState.midiClips[op.clipId].notes.map((note) =>
              note.id === op.noteId ? { ...note, time: op.time, midi: op.midi } : note
            ),
          },
        };
      }
      break;
    }

    case 'MIDI_NOTE_RESIZE': {
      if (newState.midiClips[op.clipId]) {
        newState.midiClips = {
          ...newState.midiClips,
          [op.clipId]: {
            ...newState.midiClips[op.clipId],
            notes: newState.midiClips[op.clipId].notes.map((note) =>
              note.id === op.noteId ? { ...note, duration: op.duration } : note
            ),
          },
        };
      }
      break;
    }

    case 'MIDI_NOTE_DELETE': {
      if (newState.midiClips[op.clipId]) {
        newState.midiClips = {
          ...newState.midiClips,
          [op.clipId]: {
            ...newState.midiClips[op.clipId],
            notes: newState.midiClips[op.clipId].notes.filter((note) => note.id !== op.noteId),
          },
        };
      }
      break;
    }

    // Transport operations
    case 'TRANSPORT_SET_BPM': {
      newState.transport = { ...newState.transport, bpm: op.bpm };
      break;
    }

    case 'PROJECT_RESET': {
      // Reset to fresh empty state, preserving projectId
      return {
        projectId: newState.projectId,
        version: newState.version + 1,
        tracks: {},
        audioAssets: {},
        audioClips: {},
        midiClips: {},
        trackOrder: [],
        transport: {
          bpm: 120,
        },
      };
    }

    default: {
      // Exhaustiveness check
      const _exhaustive: never = op;
      console.warn('Unknown op type:', _exhaustive);
    }
  }

  // Increment version
  newState.version = op.baseVersion + 1;

  return newState;
}

/**
 * Apply multiple operations in sequence
 */
export function applyOps(state: DawState, ops: DawOp[]): DawState {
  return ops.reduce((s, op) => applyOp(s, op), state);
}
