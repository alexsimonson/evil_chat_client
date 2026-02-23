/**
 * DAW Project Page - collaborative timeline editor
 */

import { useEffect, useState, useCallback, useRef, useReducer } from 'react';
import { Room } from 'livekit-client';
import { applyOp } from '../daw/state/store';
import { LiveKitSync } from '../daw/livekit/sync';
import { getAudioEngine } from '../daw/audio/audioEngine';
import { TransportBar } from '../daw/components/TransportBar';
import { TrackList } from '../daw/components/TrackList';
import { Timeline } from '../daw/components/Timeline';
import { PianoRoll } from '../daw/midi/pianoRoll';
import { fetchDawSnapshot, submitOps } from '../daw/api';
import type { DawState, UiState } from '../daw/types';
import { createEmptyDawState, createDefaultUiState } from '../daw/types';
import { createInitialLocalUIState, applyLocalUIAction } from '../daw/state/localState';
import type { DawOp } from '../daw/state/ops';
import type { LocalUIAction } from '../daw/state/localState';

interface ProjectDawPageProps {
  projectId: string;
  room: Room; // LiveKit room for collaboration
}

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

export function ProjectDawPage({ projectId, room }: ProjectDawPageProps) {
  const [dawState, setDawState] = useState<DawState>(createEmptyDawState(projectId));
  const [uiState, setUiState] = useState<UiState>(createDefaultUiState());
  const [localUIState, dispatchLocalUI] = useReducer(applyLocalUIAction, createInitialLocalUIState());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const syncRef = useRef<LiveKitSync | null>(null);
  const audioEngine = getAudioEngine();
  const clientId = useRef(generateId()).current;
  const pendingOps = useRef<DawOp[]>([]);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For debouncing seek operations during drag
  const pendingSeekRef = useRef<number | null>(null); // Track the latest pending seek position
  const localUIStateRef = useRef(localUIState); // Keep current local UI state for recording functions

  // Load initial state from server
  useEffect(() => {
    loadInitialState();
  }, [projectId]);

  // Set up LiveKit sync when room is ready
  useEffect(() => {
    if (!room || loading) return;

    const sync = new LiveKitSync({
      room,
      clientId,
      onOpReceived: handleRemoteOp,
      onSyncRequest: handleSyncRequest,
    });

    syncRef.current = sync;
    setIsConnected(true);

    // Request sync from other clients
    sync.requestSync();

    return () => {
      sync.dispose();
      syncRef.current = null;
    };
  }, [room, loading]);

  // Position tick broadcast removed - playhead position is now client-specific
  // Each client maintains their own playhead position locally


  const loadInitialState = async () => {
    try {
      setLoading(true);
      const { snapshot, version } = await fetchDawSnapshot(projectId);
      setDawState({ ...snapshot, version });
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleRemoteOp = useCallback((op: DawOp) => {
    // Filter out obsolete client-specific operations from old sessions
    const obsoleteOpTypes = new Set([
      'TRANSPORT_PLAY',
      'TRANSPORT_PAUSE',
      'TRANSPORT_STOP',
      'TRANSPORT_SEEK',
      'TRANSPORT_POSITION_TICK',
      'TRANSPORT_RECORD',
      'TRACK_SET_ARM',
      'TRACK_SET_MUTE',
      'TRACK_SET_SOLO',
    ]);

    if (obsoleteOpTypes.has(op.type)) {
      console.log(`[DAW] Skipping obsolete operation type: ${op.type}`);
      return;
    }

    setDawState((prev) => applyOp(prev, op));
  }, []);

  const handleSyncRequest = useCallback((fromClientId: string) => {
    // Send current state to requesting client
    syncRef.current?.sendFullState(dawState, fromClientId);
  }, [dawState]);

  const dispatchOp = useCallback((op: DawOp) => {
    // Apply locally
    setDawState((prev) => applyOp(prev, op));

    // Broadcast to others
    syncRef.current?.broadcastOp(op);

    // Queue for server persistence
    pendingOps.current.push(op);

    // Debounced server submission (simplified - in production use a proper debounce)
    setTimeout(() => {
      if (pendingOps.current.length > 0) {
        const ops = [...pendingOps.current];
        pendingOps.current = [];
        submitOps(projectId, dawState.version, ops).catch(console.error);
      }
    }, 1000);
  }, [projectId, dawState.version]);

  // Keep localUIState ref in sync so recording functions see current armed tracks
  useEffect(() => {
    localUIStateRef.current = localUIState;
  }, [localUIState]);

  // Sync playhead position from audio engine during playback
  useEffect(() => {
    if (!localUIState.isPlaying) return;

    const interval = setInterval(() => {
      const position = audioEngine.getPosition();
      dispatchLocalUI({ type: 'SET_PLAYHEAD', playheadSeconds: position });
    }, 50); // Update every 50ms for smooth playhead movement

    return () => clearInterval(interval);
  }, [localUIState.isPlaying]);

  // Transport controls - now local only
  const handlePlay = useCallback(() => {
    dispatchLocalUI({ type: 'SET_PLAYING', isPlaying: true });
    audioEngine.start(dawState, localUIState.playheadSeconds);
  }, [dawState, localUIState.playheadSeconds]);

  const handlePause = useCallback(() => {
    const position = audioEngine.getPosition();
    dispatchLocalUI({ type: 'SET_PLAYHEAD', playheadSeconds: position });
    dispatchLocalUI({ type: 'SET_PLAYING', isPlaying: false });
    audioEngine.pause();
  }, []);

  const handleStop = useCallback(() => {
    dispatchLocalUI({ type: 'SET_PLAYHEAD', playheadSeconds: 0 });
    dispatchLocalUI({ type: 'SET_PLAYING', isPlaying: false });
    audioEngine.stop();
  }, []);

  const handleSeek = useCallback((seconds: number) => {
    // Store the pending seek position
    pendingSeekRef.current = seconds;

    // Clear any existing timeout
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
    }

    // Set a new debounce timer - updates local playhead position after 50ms of no new seeks
    seekTimeoutRef.current = setTimeout(() => {
      const seekPosition = pendingSeekRef.current ?? seconds;
      dispatchLocalUI({ type: 'SET_PLAYHEAD', playheadSeconds: seekPosition });
      audioEngine.seek(seekPosition);
      seekTimeoutRef.current = null;
      pendingSeekRef.current = null;
    }, 50); // Debounce for 50ms - batches rapid seeks from dragging
  }, []);

  const handleSetBpm = useCallback((bpm: number) => {
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'TRANSPORT_SET_BPM',
      bpm,
    };
    dispatchOp(op);
    audioEngine.setBpm(bpm);
  }, [dawState, dispatchOp]);

  // Track controls
  const handleAddTrack = useCallback((type: 'audio' | 'midi') => {
    const trackId = generateId();
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'TRACK_ADD',
      trackId,
      trackType: type,
      name: `${type === 'audio' ? 'Audio' : 'MIDI'} Track ${Object.keys(dawState.tracks).length + 1}`,
      sortOrder: Object.keys(dawState.tracks).length,
    };
    dispatchOp(op);
  }, [dawState, dispatchOp]);

  const handleRemoveTrack = useCallback((trackId: string) => {
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'TRACK_REMOVE',
      trackId,
    };
    dispatchOp(op);
  }, [dawState, dispatchOp]);

  const handleRenameTrack = useCallback((trackId: string, name: string) => {
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'TRACK_RENAME',
      trackId,
      name,
    };
    dispatchOp(op);
  }, [dawState, dispatchOp]);

  const handleSetVolume = useCallback((trackId: string, volume: number) => {
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'TRACK_SET_VOLUME',
      trackId,
      volume,
    };
    dispatchOp(op);
  }, [dawState, dispatchOp]);

  const handleSetMute = useCallback((trackId: string, mute: boolean) => {
    dispatchLocalUI({ type: 'SET_LOCAL_MUTE', trackId, muted: mute });
  }, []);

  const handleSetSolo = useCallback((trackId: string, solo: boolean) => {
    dispatchLocalUI({ type: 'SET_LOCAL_SOLO', trackId, soloed: solo });
  }, []);

  const handleSetArm = useCallback((trackId: string, armed: boolean) => {
    dispatchLocalUI({ type: 'SET_ARMED_TRACK', trackId, armed });
  }, []);

  const handleRecord = useCallback(() => {
    const newRecordingState = !localUIState.isRecording;
    dispatchLocalUI({ type: 'SET_RECORDING', isRecording: newRecordingState });
  }, [localUIState.isRecording]);

  const handleReset = useCallback(() => {
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'PROJECT_RESET',
    };
    dispatchOp(op);
    audioEngine.stop();
    setUiState(createDefaultUiState());
  }, [dawState, dispatchOp]);

  // MIDI controls
  const handleAddMidiNote = useCallback((clipId: string, time: number, midi: number, duration: number, velocity: number) => {
    const noteId = generateId();
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'MIDI_NOTE_ADD',
      clipId,
      noteId,
      time,
      duration,
      midi,
      velocity,
    };
    dispatchOp(op);
  }, [dawState, dispatchOp]);

  const handleMoveMidiNote = useCallback((clipId: string, noteId: string, time: number, midi: number) => {
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'MIDI_NOTE_MOVE',
      clipId,
      noteId,
      time,
      midi,
    };
    dispatchOp(op);
  }, [dawState, dispatchOp]);

  const handleResizeMidiNote = useCallback((clipId: string, noteId: string, duration: number) => {
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'MIDI_NOTE_RESIZE',
      clipId,
      noteId,
      duration,
    };
    dispatchOp(op);
  }, [dawState, dispatchOp]);

  const handleDeleteMidiNote = useCallback((clipId: string, noteId: string) => {
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'MIDI_NOTE_DELETE',
      clipId,
      noteId,
    };
    dispatchOp(op);
  }, [dawState, dispatchOp]);

  // Cleanup: clear pending seeks on unmount
  useEffect(() => {
    return () => {
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
    };
  }, []);

  if (loading) {
    return <div style={{ padding: 20 }}>Loading DAW...</div>;
  }

  if (error) {
    return <div style={{ padding: 20, color: 'red' }}>Error: {error}</div>;
  }

  const tracks = dawState.trackOrder.map((id) => dawState.tracks[id]);
  const editingClip = uiState.editingMidiClipId ? dawState.midiClips[uiState.editingMidiClipId] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a1a1a' }}>
      {/* Transport bar */}
      <TransportBar
        playheadSeconds={localUIState.playheadSeconds}
        isPlaying={localUIState.isPlaying}
        isRecording={localUIState.isRecording}
        bpm={dawState.transport.bpm}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onRecord={handleRecord}
        onSeek={handleSeek}
        onSetBpm={handleSetBpm}
        onReset={handleReset}
      />

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Track list */}
        <TrackList
          tracks={tracks}
          selectedTrackId={uiState.selectedTrackId}
          armedTrackIds={localUIState.armedTrackIds}
          mutedTrackIds={localUIState.muteTrackIds}
          soloedTrackIds={localUIState.soloTrackIds}
          onSelectTrack={(id) => setUiState({ ...uiState, selectedTrackId: id })}
          onAddTrack={handleAddTrack}
          onRemoveTrack={handleRemoveTrack}
          onRenameTrack={handleRenameTrack}
          onSetVolume={handleSetVolume}
          onSetMute={handleSetMute}
          onSetSolo={handleSetSolo}
          onSetArm={handleSetArm}
        />

        {/* Timeline */}
        <Timeline
          state={dawState}
          playheadSeconds={localUIState.playheadSeconds}
          isPlaying={localUIState.isPlaying}
          zoom={uiState.zoom}
          selectedClipId={uiState.selectedClipId}
          onSelectClip={(id, type) => setUiState({ ...uiState, selectedClipId: id, selectedClipType: type })}
          onAudioClipMove={(clipId, start) => {
            const op: DawOp = {
              id: generateId(),
              clientId,
              timestamp: Date.now(),
              baseVersion: dawState.version,
              type: 'AUDIO_CLIP_MOVE',
              clipId,
              start,
            };
            dispatchOp(op);
          }}
          onMidiClipMove={(clipId, start) => {
            const op: DawOp = {
              id: generateId(),
              clientId,
              timestamp: Date.now(),
              baseVersion: dawState.version,
              type: 'MIDI_CLIP_MOVE',
              clipId,
              start,
            };
            dispatchOp(op);
          }}
          onOpenMidiEditor={(clipId) => setUiState({ ...uiState, editingMidiClipId: clipId })}
          onSeek={handleSeek}
        />
      </div>

      {/* Piano roll (if MIDI clip is being edited) */}
      {editingClip && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100 }}>
          <PianoRoll
            clip={editingClip}
            onAddNote={(time, midi, dur, vel) => handleAddMidiNote(editingClip.id, time, midi, dur, vel)}
            onMoveNote={(noteId, time, midi) => handleMoveMidiNote(editingClip.id, noteId, time, midi)}
            onResizeNote={(noteId, dur) => handleResizeMidiNote(editingClip.id, noteId, dur)}
            onDeleteNote={(noteId) => handleDeleteMidiNote(editingClip.id, noteId)}
            zoom={uiState.zoom}
          />
          <button
            onClick={() => setUiState({ ...uiState, editingMidiClipId: null })}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              padding: '8px 16px',
              background: '#ff4a4a',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Close Piano Roll
          </button>
        </div>
      )}

      {/* Status bar */}
      <div style={{ padding: '5px 10px', background: '#222', borderTop: '1px solid #444', color: '#666', fontSize: '11px' }}>
        Connected: {isConnected ? '✓' : '✗'} | Version: {dawState.version} | Zoom: {uiState.zoom}px/s
      </div>
    </div>
  );
}
