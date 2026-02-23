/**
 * Simple DAW View - directly accessible, shared project
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Room } from 'livekit-client';
import { applyOp } from '../daw/state/store';
import { getAudioEngine } from '../daw/audio/audioEngine';
import { createRecording } from '../daw/audio/useRecording';
import { LiveKitSync } from '../daw/livekit/sync';
import { TransportBar } from '../daw/components/TransportBar';
import { TrackList } from '../daw/components/TrackList';
import { Timeline } from '../daw/components/Timeline';
import { PianoRoll } from '../daw/midi/pianoRoll';
import type { DawState, UiState } from '../daw/types';
import { createEmptyDawState, createDefaultUiState } from '../daw/types';
import type { DawOp } from '../daw/state/ops';

const generateId = () => Math.random().toString(36).substring(2, 15);
const API_URL = import.meta.env.VITE_API_URL as string;

export function SimpleDawView() {
  const [dawState, setDawState] = useState<DawState>(createEmptyDawState('shared-project'));
  const [uiState, setUiState] = useState<UiState>(createDefaultUiState());
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);

  const audioEngine = getAudioEngine();
  const clientId = useRef(generateId()).current;
  const livekitSyncRef = useRef<LiveKitSync | null>(null);
  const recordingFunctionsRef = useRef<{ start: () => Promise<void>; stop: () => void } | null>(null);
  const dawStateRef = useRef<DawState | null>(null); // Keep current state for recording functions
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For debouncing seek operations during drag
  const pendingSeekRef = useRef<number | null>(null); // Track the latest pending seek position

  // Fetch shared DAW project ID
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/projects/shared-daw`, {
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error('Failed to fetch shared DAW project');
        }

        const project = await res.json();
        setProjectId(project.id);
      } catch (error) {
        console.error('[DAW] Failed to fetch project:', error);
        setConnectionError('Failed to load shared DAW project');
      } finally {
        setIsLoadingProject(false);
      }
    })();
  }, []);

  // Load all operations from server when project is ready
  useEffect(() => {
    if (!projectId) return;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/projects/${projectId}/daw/ops`, {
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error('Failed to fetch operations');
        }

        const { operations } = await res.json();
        console.log(`[DAW] Loaded ${operations.length} operations from server`);

        // Replay all operations to build initial state
        setDawState((prev) => {
          let state = prev;
          for (const op of operations) {
            state = applyOp(state, op);
          }
          return state;
        });
      } catch (error) {
        console.error('[DAW] Failed to load operations:', error);
      }
    })();
  }, [projectId]);

  // Initialize LiveKit room for shared DAW session
  useEffect(() => {
    const newRoom = new Room();
    let mounted = true;
    
    // Connect to the DAW room
    (async () => {
      try {
        // Get token from server
        const res = await fetch(`${API_URL}/livekit/daw-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Failed to get DAW token: ${res.status}`);
        }

        const { token, url, iceServers } = await res.json();
        
        if (!mounted) return;

        await newRoom.connect(url, token, {
          rtcConfig: {
            iceServers: iceServers || [{ urls: "stun:stun.l.google.com:19302" }],
          },
        });

        console.log('[DAW] Connected to shared room');
        if (mounted) {
          setRoom(newRoom);
          setIsConnecting(false);
        }
      } catch (error) {
        console.error('[DAW] Failed to connect to room:', error);
        if (mounted) {
          setConnectionError(error instanceof Error ? error.message : 'Connection failed');
          setIsConnecting(false);
        }
      }
    })();

    return () => {
      mounted = false;
      newRoom.disconnect();
    };
  }, []);

  // Initialize LiveKit sync when room is ready
  useEffect(() => {
    if (!room) return;

    const sync = new LiveKitSync({
      room,
      clientId,
      onOpReceived: (op: DawOp) => {
        console.log('[DAW] Received op:', op.type);
        setDawState((prev) => applyOp(prev, op));
      },
      onSyncRequest: (fromClientId: string) => {
        console.log('[DAW] Sync requested by:', fromClientId);
        // Could send full state here
      },
    });

    livekitSyncRef.current = sync;

    return () => {
      livekitSyncRef.current = null;
    };
  }, [room, clientId]);
  
  const dispatchOp = useCallback((op: DawOp) => {
    console.log('[DAW] Dispatching operation:', op);
    
    // Apply locally
    setDawState((prev) => applyOp(prev, op));
    
    // Broadcast to other users via LiveKit
    if (livekitSyncRef.current) {
      livekitSyncRef.current.broadcastOp(op);
    }

    // Save to server with automatic retry on conflict
    if (projectId) {
      const submitWithRetry = async (retryCount = 0, maxRetries = 3) => {
        const payload = { baseVersion: op.baseVersion, ops: [op] };
        console.log('[DAW] Sending to server:', payload);
        
        try {
          const res = await fetch(`${API_URL}/projects/${projectId}/daw/ops`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            
            // Handle version conflicts with automatic retry
            if (res.status === 409 && retryCount < maxRetries) {
              console.warn(`[DAW] Version conflict (attempt ${retryCount + 1}/${maxRetries}). Server version: ${errorData.serverVersion}`);
              
              // Reload current state from server
              try {
                const snapshotRes = await fetch(`${API_URL}/projects/${projectId}/daw/ops`, {
                  credentials: 'include',
                });
                
                if (snapshotRes.ok) {
                  const responseData = await snapshotRes.json();
                  const correctedVersion = responseData.version;
                  console.log(`[DAW] Reloaded from server. Correct version is: ${correctedVersion}`);
                  
                  // Retry with corrected version
                  const correctedOp = { ...op, baseVersion: correctedVersion };
                  console.log(`[DAW] Retrying with corrected baseVersion: ${correctedVersion}`);
                  
                  // Replay through the system to update state
                  setDawState((prev) => applyOp(prev, correctedOp));
                  
                  // Recursively retry
                  await submitWithRetry(retryCount + 1, maxRetries);
                  return;
                }
              } catch (reloadError) {
                console.error('[DAW] Failed to reload version from server:', reloadError);
              }
            }
            
            const msg = `Server error: ${errorData.error || res.statusText}${errorData.message ? ` - ${errorData.message}` : ''}`;
            console.error('[DAW] Failed to save operation:', msg);
            throw new Error(msg);
          }

          const result = await res.json();
          console.log('[DAW] Operation saved to server:', result);
        } catch (error) {
          console.error('[DAW] Failed to save operation:', error);
          alert('[DAW Error] Failed to save operation: ' + (error instanceof Error ? error.message : String(error)));
        }
      };

      submitWithRetry();
    }
  }, [projectId]);

  // Initialize recording functions after dispatchOp is available
  // ONLY recreate when: projectId changes, dawState.tracks/versions change, or clientId changes
  // NOT on every dispatchOp call
  useEffect(() => {
    const handleRecordingComplete = (blob: Blob, armedTrackIds: string[], duration: number) => {
      console.log(`[DAW] handleRecordingComplete called: ${duration.toFixed(2)}s on ${armedTrackIds.length} tracks, blob size: ${blob.size}`);
      console.log(`[DAW] Project ID: ${projectId}, Armed track IDs:`, armedTrackIds);

      // Upload blob to server and create audio asset + clips
      const uploadRecording = async () => {
        try {
          console.log('[DAW] Starting uploadRecording...');
          
          // Validate we have required data
          if (!projectId) {
            throw new Error('Project ID is null');
          }
          if (armedTrackIds.length === 0) {
            throw new Error('No armed track IDs provided');
          }
          if (blob.size === 0) {
            throw new Error('Recording blob is empty');
          }

          // Convert blob to base64 for transmission
          const reader = new FileReader();
          console.log('[DAW] FileReader created, starting to read blob as data URL...');
          
          reader.onloadstart = () => {
            console.log('[DAW] FileReader: loadstart event fired');
          };
          
          reader.onload = async () => {
            console.log('[DAW] FileReader: onload event fired');
            const base64Data = reader.result as string;
            console.log(`[DAW] Base64 data created, length: ${base64Data.length} characters`);

            // Upload the recorded audio
            console.log('[DAW] Sending upload request to server...');
            const uploadRes = await fetch(`${API_URL}/projects/${projectId}/audio/upload`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                audioData: base64Data,
                mimeType: blob.type,
                duration,
              }),
            });

            console.log(`[DAW] Upload response received: status ${uploadRes.status}`);

            if (!uploadRes.ok) {
              const error = await uploadRes.json().catch(() => ({}));
              throw new Error(`Upload failed: ${error.error || uploadRes.statusText}`);
            }

            const { audioUrl } = await uploadRes.json();
            console.log('[DAW] Recording uploaded successfully, audioUrl:', audioUrl);

            // Create AUDIO_ASSET_ADD operation
            const assetId = generateId();
            const assetOp: DawOp = {
              id: generateId(),
              clientId,
              timestamp: Date.now(),
              baseVersion: dawState.version,
              type: 'AUDIO_ASSET_ADD',
              assetId,
              url: audioUrl,
              duration,
              name: `Recording ${new Date().toLocaleTimeString()}`,
            };
            console.log('[DAW] Dispatching AUDIO_ASSET_ADD op, asset ID:', assetId);
            dispatchOp(assetOp);

            // Create audio clips on each armed track
            let currentVersion = dawState.version + 1;
            armedTrackIds.forEach((trackId, index) => {
              const clipId = generateId();
              const clipOp: DawOp = {
                id: generateId(),
                clientId,
                timestamp: Date.now(),
                baseVersion: currentVersion + index,
                type: 'AUDIO_CLIP_ADD',
                clipId,
                trackId,
                assetId,
                start: dawState.transport.positionSeconds,
                duration,
                gain: 0.8,
                offset: 0,
              };
              console.log(`[DAW] Dispatching AUDIO_CLIP_ADD op for track ${trackId}, clip ID: ${clipId}`);
              dispatchOp(clipOp);
            });

            console.log('[DAW] All operations dispatched successfully!');
          };
          
          reader.onerror = (error) => {
            console.error('[DAW] FileReader error:', error);
            throw new Error(`FileReader error: ${error}`);
          };
          
          console.log('[DAW] Calling reader.readAsDataURL...');
          reader.readAsDataURL(blob);
        } catch (error) {
          console.error('[DAW] Failed to save recording:', error);
          alert(`Recording completed but failed to sync: ${error instanceof Error ? error.message : String(error)}`);
        }
      };

      console.log('[DAW] Calling uploadRecording()');
      uploadRecording();
    };

    // Create recording functions - store in ref for persistence across renders
    // Note: Armed tracks are checked dynamically when recording starts using the ref
    const recordingFuncs = createRecording(
      () => {
        // Get armed tracks dynamically at the time of use from ref (always current)
        if (!dawStateRef.current) return [];
        return Object.entries(dawStateRef.current.tracks)
          .filter(([_, track]) => track.type === 'audio' && track.armed)
          .map(([id]) => id);
      },
      handleRecordingComplete
    );
    recordingFunctionsRef.current = recordingFuncs;
    console.log('[DAW] Recording functions created and stored in ref');
  }, [projectId, clientId]);

  // Keep dawState ref in sync with current state so recording functions always see current tracks
  useEffect(() => {
    dawStateRef.current = dawState;
  }, [dawState]);

  // Transport controls
  const handlePlay = useCallback(() => {
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'TRANSPORT_PLAY',
      positionSeconds: dawState.transport.positionSeconds,
      startedAtWallClock: Date.now(),
      hostClientId: clientId,
    };
    dispatchOp(op);
    audioEngine.start(dawState);
  }, [dawState, dispatchOp, clientId]);

  const handlePause = useCallback(() => {
    const position = audioEngine.getPosition();
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'TRANSPORT_PAUSE',
      positionSeconds: position,
    };
    dispatchOp(op);
    audioEngine.pause();
  }, [dawState, dispatchOp, clientId]);

  const handleStop = useCallback(() => {
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'TRANSPORT_STOP',
    };
    dispatchOp(op);
    audioEngine.stop();
  }, [dawState, dispatchOp, clientId]);

  const handleSeek = useCallback((seconds: number) => {
    // Store the pending seek position
    pendingSeekRef.current = seconds;

    // Clear any existing timeout
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
    }

    // Set a new debounce timer - sends seek operation after 50ms of no new seeks
    seekTimeoutRef.current = setTimeout(() => {
      const seekPosition = pendingSeekRef.current ?? seconds;
      const op: DawOp = {
        id: generateId(),
        clientId,
        timestamp: Date.now(),
        baseVersion: dawState.version,
        type: 'TRANSPORT_SEEK',
        positionSeconds: seekPosition,
      };
      dispatchOp(op);
      audioEngine.seek(seekPosition);
      seekTimeoutRef.current = null;
      pendingSeekRef.current = null;
    }, 50); // Debounce for 50ms - batches rapid seeks from dragging
  }, [dawState, dispatchOp, clientId]);

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
  }, [dawState, dispatchOp, clientId]);

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
  }, [dawState, dispatchOp, clientId]);

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
  }, [dawState, dispatchOp, clientId]);

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
  }, [dawState, dispatchOp, clientId]);

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
  }, [dawState, dispatchOp, clientId]);

  const handleSetMute = useCallback((trackId: string, mute: boolean) => {
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'TRACK_SET_MUTE',
      trackId,
      mute,
    };
    dispatchOp(op);
  }, [dawState, dispatchOp, clientId]);

  const handleSetSolo = useCallback((trackId: string, solo: boolean) => {
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'TRACK_SET_SOLO',
      trackId,
      solo,
    };
    dispatchOp(op);
  }, [dawState, dispatchOp, clientId]);

  const handleSetArm = useCallback((trackId: string, armed: boolean) => {
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'TRACK_SET_ARM',
      trackId,
      armed,
    };
    dispatchOp(op);
  }, [dawState, dispatchOp, clientId]);

  const handleRecord = useCallback(() => {
    const newRecordingState = !dawState.transport.isRecording;
    const op: DawOp = {
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'TRANSPORT_RECORD',
      isRecording: newRecordingState,
    };
    dispatchOp(op);

    if (newRecordingState) {
      // Check if we have armed audio tracks
      const armedAudioTracks = Object.entries(dawState.tracks)
        .filter(([_, track]) => track.type === 'audio' && track.armed);

      if (armedAudioTracks.length === 0) {
        alert('Please arm at least one audio track to record');
        // Disable recording if no armed tracks
        dispatchOp({
          id: generateId(),
          clientId,
          timestamp: Date.now(),
          baseVersion: dawState.version + 1,
          type: 'TRANSPORT_RECORD',
          isRecording: false,
        });
        return;
      }

      console.log('[DAW] Starting recording on armed audio tracks');
      console.log('[DAW] recordingFunctions available:', recordingFunctionsRef.current !== null);
      if (recordingFunctionsRef.current) {
        console.log('[DAW] Calling recordingFunctions.start()');
        recordingFunctionsRef.current.start().catch(err => console.error('[DAW] Recording start error:', err));
      } else {
        console.warn('[DAW] recordingFunctions is null! Recording not started.');
      }
    } else {
      console.log('[DAW] Stopping recording');
      console.log('[DAW] recordingFunctions available:', recordingFunctionsRef.current !== null);
      if (recordingFunctionsRef.current) {
        console.log('[DAW] Calling recordingFunctions.stop()');
        recordingFunctionsRef.current.stop();
      } else {
        console.warn('[DAW] recordingFunctions is null! Recording not stopped.');
      }
    }
  }, [dawState, dispatchOp, clientId, recordingFunctionsRef]);

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
  }, [dawState, dispatchOp, clientId]);

  // Add test MIDI clip
  const handleAddTestClip = useCallback(() => {
    const midiTrackId = Object.keys(dawState.tracks).find(
      id => dawState.tracks[id].type === 'midi'
    );
    
    if (!midiTrackId) {
      alert('Create a MIDI track first!');
      return;
    }
    
    const clipId = generateId();
    dispatchOp({
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: dawState.version,
      type: 'MIDI_CLIP_ADD',
      clipId,
      trackId: midiTrackId,
      start: 0,
      duration: 8,
    });
    
    // Add C major scale notes
    [60, 62, 64, 65, 67, 69, 71, 72].forEach((midi, i) => {
      dispatchOp({
        id: generateId(),
        clientId,
        timestamp: Date.now(),
        baseVersion: dawState.version,
        type: 'MIDI_NOTE_ADD',
        clipId,
        noteId: generateId(),
        time: i * 0.5,
        duration: 0.4,
        midi,
        velocity: 80,
      });
    });
  }, [dawState, dispatchOp, clientId]);

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
  }, [dawState, dispatchOp, clientId]);

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
  }, [dawState, dispatchOp, clientId]);

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
  }, [dawState, dispatchOp, clientId]);

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
  }, [dawState, dispatchOp, clientId]);

  // Cleanup: clear pending seeks on unmount
  useEffect(() => {
    return () => {
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
    };
  }, []);

  const tracks = dawState.trackOrder.map((id) => dawState.tracks[id]);
  const editingClip = uiState.editingMidiClipId ? dawState.midiClips[uiState.editingMidiClipId] : null;

  // Show loading state while loading project or connecting
  if (isLoadingProject || isConnecting) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a1a1a', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <div style={{ fontSize: '18px', marginBottom: '10px' }}>
          {isLoadingProject ? 'Loading shared DAW project...' : 'Connecting to shared DAW...'}
        </div>
        <div style={{ fontSize: '12px', color: '#888' }}>
          {isLoadingProject ? 'Fetching project state from server' : 'Establishing real-time collaboration'}
        </div>
      </div>
    );
  }

  // Show error state if connection failed
  if (connectionError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a1a1a', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '20px', padding: '20px' }}>
        <div style={{ fontSize: '18px', color: '#ff4a4a' }}>Failed to connect to DAW</div>
        <div style={{ fontSize: '12px', color: '#888', maxWidth: '400px', textAlign: 'center' }}>
          {connectionError}
        </div>
        <div style={{ fontSize: '12px', color: '#888' }}>
          Working in local-only mode. Changes won't sync to other users.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            background: '#4a9eff',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a1a1a' }}>
      {/* Transport bar */}
      <TransportBar
        transport={dawState.transport}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onRecord={handleRecord}
        onSeek={handleSeek}
        onSetBpm={handleSetBpm}
        onReset={handleReset}
      />

      {/* Helper toolbar */}
      <div style={{ padding: '10px 20px', background: '#333', borderBottom: '1px solid #444', display: 'flex', gap: '10px', color: '#fff', alignItems: 'center' }}>
        <button
          onClick={handleAddTestClip}
          style={{
            padding: '6px 12px',
            background: '#9e4aff',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          🎹 Add Test MIDI Clip
        </button>
        <span style={{ fontSize: '12px', color: '#888', lineHeight: '28px' }}>
          Tip: Add MIDI track first, then click to add test clip. Double-click clip to edit notes.
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: room ? '#4caf50' : '#888' }}>
          {room ? '🟢 Connected to shared DAW' : '⚪ Disconnected'}
        </span>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Track list */}
        <TrackList
          tracks={tracks}
          selectedTrackId={uiState.selectedTrackId}
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
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: '#1a1a1a' }}>
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
        Tracks: {tracks.length} | Version: {dawState.version} | Zoom: {uiState.zoom}px/s
      </div>
    </div>
  );
}
