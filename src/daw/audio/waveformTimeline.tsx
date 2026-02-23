/**
 * Waveform timeline component using waveform-playlist
 */

import { useEffect, useRef } from 'react';
// @ts-ignore - waveform-playlist doesn't have types
import WaveformPlaylist from 'waveform-playlist';
import type { DawState } from '../types';

interface WaveformTimelineProps {
  state: DawState;
  zoom: number; // pixels per second
  onClipMove?: (clipId: string, newStart: number, newTrackId?: string) => void;
  onClipResize?: (clipId: string, newDuration: number, newOffset?: number) => void;
}

export function WaveformTimeline({ state, zoom }: WaveformTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playlistRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize waveform-playlist
    const playlist = WaveformPlaylist({
      container: containerRef.current,
      state: 'cursor',
      colors: {
        waveOutlineColor: '#E0EFF1',
        timeColor: 'grey',
        fadeColor: 'black',
      },
      controls: {
        show: false, // We'll use custom transport controls
        width: 0,
      },
      samplesPerPixel: 44100 / zoom, // Adjust based on zoom
      waveHeight: 80,
      isAutomaticScroll: false,
    });

    playlistRef.current = playlist;

    // Clean up on unmount
    return () => {
      if (playlistRef.current) {
        // Cleanup if needed
      }
    };
  }, [zoom]);

  useEffect(() => {
    if (!playlistRef.current) return;

    // Update playlist with current state
    updatePlaylist(playlistRef.current, state);
  }, [state]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        overflow: 'auto',
        background: '#1e1e1e',
      }} 
    />
  );
}

/**
 * Update the waveform playlist with current DAW state
 * Note: This is a simplified implementation. Full integration would require
 * more complex state synchronization with waveform-playlist's internal state.
 */
function updatePlaylist(_playlist: any, _state: DawState) {
  // Get audio tracks in order
  // const audioTracks = _state.trackOrder
  //   .map((id) => _state.tracks[id])
  //   .filter((track) => track.type === 'audio');

  // Build track data for waveform-playlist
  // const tracks = audioTracks.map((track) => {
  //   // Get clips for this track
  //   const clips = Object.values(_state.audioClips)
  //     .filter((clip) => clip.trackId === track.id)
  //     .sort((a, b) => a.start - b.start);
  //
  //   // Convert clips to waveform-playlist format
  //   return {
  //     name: track.name,
  //     gain: track.volume,
  //     muted: track.mute,
  //     soloed: track.solo,
  //     // Note: waveform-playlist expects specific format
  //     // For MVP, we'll render a simplified version
  //     // Full implementation would need to convert AudioClips to playlist's internal format
  //   };
  // });

  // For MVP, we'll show a note that waveform-playlist integration is simplified
  // In production, you would:
  // 1. Load audio files via playlist.load()
  // 2. Set up region markers for clips
  // 3. Handle events for clip editing
  // 4. Sync with Tone.js transport
}
