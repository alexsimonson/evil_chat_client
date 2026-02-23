/**
 * Main timeline component - renders audio and MIDI clips
 */

import React, { useRef, useEffect } from 'react';
import type { DawState, AudioClip, MidiClip, Track } from '../types';

interface TimelineProps {
  state: DawState;
  zoom: number; // pixels per second
  selectedClipId: string | null;
  onSelectClip: (clipId: string, type: 'audio' | 'midi') => void;
  onAudioClipMove: (clipId: string, newStart: number) => void;
  onMidiClipMove: (clipId: string, newStart: number) => void;
  onOpenMidiEditor: (clipId: string) => void;
  onSeek: (positionSeconds: number) => void;
}

export function Timeline({
  state,
  zoom,
  selectedClipId,
  onSelectClip,
  onAudioClipMove,
  onMidiClipMove,
  onOpenMidiEditor,
  onSeek,
}: TimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragState, setDragState] = React.useState<{
    clipId: string | null;
    type: 'audio' | 'midi' | null;
    startX: number;
    originalStart: number;
    draggingPlayhead: boolean;
  }>({ clipId: null, type: null, startX: 0, originalStart: 0, draggingPlayhead: false });
  const [playheadPosition, setPlayheadPosition] = React.useState(state.transport.positionSeconds);

  const tracks = state.trackOrder.map((id) => state.tracks[id]);
  const TRACK_HEIGHT = 80;
  const HEADER_HEIGHT = 30;

  // Update playhead position during playback or when state changes
  useEffect(() => {
    if (!state.transport.isPlaying || !state.transport.startedAtWallClock) {
      // Not playing, use the state position
      setPlayheadPosition(state.transport.positionSeconds);
      return;
    }

    // Set up animation frame loop for smooth playhead movement during playback
    let animationFrameId: number;

    const updatePlayheadPosition = () => {
      const elapsed = (Date.now() - state.transport.startedAtWallClock!) / 1000;
      const currentPosition = state.transport.positionSeconds + elapsed;
      setPlayheadPosition(currentPosition);
      animationFrameId = requestAnimationFrame(updatePlayheadPosition);
    };

    animationFrameId = requestAnimationFrame(updatePlayheadPosition);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state.transport.isPlaying, state.transport.positionSeconds, state.transport.startedAtWallClock]);

  useEffect(() => {
    drawTimeline();
  }, [state, zoom, selectedClipId, playheadPosition]);

  const drawTimeline = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const duration = 300; // Show 300 seconds (5 minutes) by default
    const width = Math.max(duration * zoom, canvas.clientWidth);
    const height = tracks.length * TRACK_HEIGHT + HEADER_HEIGHT;

    canvas.width = width;
    canvas.height = height;

    // Clear
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw time ruler
    drawTimeRuler(ctx, width);

    // Draw tracks
    tracks.forEach((track, index) => {
      drawTrack(ctx, track, index);
    });

    // Draw playhead
    const playheadX = playheadPosition * zoom;
    ctx.strokeStyle = '#ff4a4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, HEADER_HEIGHT);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
  };

  const drawTimeRuler = (ctx: CanvasRenderingContext2D, width: number) => {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, width, HEADER_HEIGHT);

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';

    // Draw second markers
    const secondInterval = zoom; // pixels per second
    for (let sec = 0; sec < width / zoom; sec++) {
      const x = sec * secondInterval;
      
      // Major tick every 5 seconds
      if (sec % 5 === 0) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEADER_HEIGHT);
        ctx.stroke();
        ctx.fillText(`${sec}s`, x + 2, 12);
      } else {
        ctx.beginPath();
        ctx.moveTo(x, HEADER_HEIGHT - 5);
        ctx.lineTo(x, HEADER_HEIGHT);
        ctx.stroke();
      }
    }
  };

  const drawTrack = (ctx: CanvasRenderingContext2D, track: Track, index: number) => {
    const y = HEADER_HEIGHT + index * TRACK_HEIGHT;

    // Track background
    ctx.fillStyle = index % 2 === 0 ? '#1e1e1e' : '#222';
    ctx.fillRect(0, y, ctx.canvas.width, TRACK_HEIGHT);

    // Track border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, y, ctx.canvas.width, TRACK_HEIGHT);

    // Draw clips
    if (track.type === 'audio') {
      Object.values(state.audioClips)
        .filter((clip) => clip.trackId === track.id)
        .forEach((clip) => drawAudioClip(ctx, clip, y));
    } else if (track.type === 'midi') {
      Object.values(state.midiClips)
        .filter((clip) => clip.trackId === track.id)
        .forEach((clip) => drawMidiClip(ctx, clip, y));
    }
  };

  const drawAudioClip = (ctx: CanvasRenderingContext2D, clip: AudioClip, trackY: number) => {
    const x = clip.start * zoom;
    const w = clip.duration * zoom;
    const h = TRACK_HEIGHT - 10;
    const y = trackY + 5;

    const isSelected = clip.id === selectedClipId;

    // Clip background
    ctx.fillStyle = isSelected ? '#4a7f9e' : '#2a5f7f';
    ctx.fillRect(x, y, w, h);

    // Clip border
    ctx.strokeStyle = isSelected ? '#6bb6ff' : '#3a8fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Clip label
    const asset = state.audioAssets[clip.assetId];
    if (asset) {
      ctx.fillStyle = '#fff';
      ctx.font = '11px sans-serif';
      ctx.fillText(asset.name, x + 5, y + 15);
    }

    // Waveform placeholder (simplified - would use actual waveform data in production)
    ctx.strokeStyle = '#5af';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < w; i += 2) {
      const amplitude = Math.sin(i * 0.1) * (h / 4) + h / 2;
      if (i === 0) {
        ctx.moveTo(x + i, y + amplitude);
      } else {
        ctx.lineTo(x + i, y + amplitude);
      }
    }
    ctx.stroke();
  };

  const drawMidiClip = (ctx: CanvasRenderingContext2D, clip: MidiClip, trackY: number) => {
    const x = clip.start * zoom;
    const w = clip.duration * zoom;
    const h = TRACK_HEIGHT - 10;
    const y = trackY + 5;

    const isSelected = clip.id === selectedClipId;

    // Clip background
    ctx.fillStyle = isSelected ? '#7f4a9e' : '#5f2a7f';
    ctx.fillRect(x, y, w, h);

    // Clip border
    ctx.strokeStyle = isSelected ? '#b66bff' : '#8f3aff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Clip label
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.fillText(`MIDI Clip (${clip.notes.length} notes)`, x + 5, y + 15);

    // Draw mini piano roll preview
    if (clip.notes.length > 0) {
      const minMidi = Math.min(...clip.notes.map((n) => n.midi));
      const maxMidi = Math.max(...clip.notes.map((n) => n.midi));
      const midiRange = Math.max(1, maxMidi - minMidi);

      ctx.fillStyle = '#fff';
      clip.notes.forEach((note) => {
        const noteX = x + (note.time / clip.duration) * w;
        const noteW = (note.duration / clip.duration) * w;
        const noteY = y + h - ((note.midi - minMidi) / midiRange) * (h - 20) - 20;
        const noteH = 3;
        ctx.fillRect(noteX, noteY, Math.max(2, noteW), noteH);
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + canvas.parentElement!.scrollLeft;
    const y = e.clientY - rect.top + canvas.parentElement!.scrollTop;

    // Check if clicking in the header (ruler area)
    if (y < HEADER_HEIGHT) {
      // Clicking on the ruler - seek or drag playhead
      const clickTime = x / zoom;
      onSeek(Math.max(0, clickTime));
      
      // Allow dragging the playhead from the ruler area
      setDragState({
        clipId: null,
        type: null,
        startX: x,
        originalStart: playheadPosition,
        draggingPlayhead: true,
      });
      return;
    }

    // Check playhead click tolerance (5 pixels on either side)
    const playheadX = playheadPosition * zoom;
    if (Math.abs(x - playheadX) < 10) {
      // Clicked on playhead - start dragging it
      setDragState({
        clipId: null,
        type: null,
        startX: x,
        originalStart: playheadPosition,
        draggingPlayhead: true,
      });
      return;
    }

    // Check if clicking on a clip
    const trackIndex = Math.floor((y - HEADER_HEIGHT) / TRACK_HEIGHT);
    if (trackIndex < 0 || trackIndex >= tracks.length) return;

    const track = tracks[trackIndex];
    const clickTime = x / zoom;

    if (track.type === 'audio') {
      const clip = Object.values(state.audioClips).find(
        (c) => c.trackId === track.id && clickTime >= c.start && clickTime <= c.start + c.duration
      );
      if (clip) {
        onSelectClip(clip.id, 'audio');
        setDragState({ clipId: clip.id, type: 'audio', startX: x, originalStart: clip.start, draggingPlayhead: false });
      }
    } else if (track.type === 'midi') {
      const clip = Object.values(state.midiClips).find(
        (c) => c.trackId === track.id && clickTime >= c.start && clickTime <= c.start + c.duration
      );
      if (clip) {
        onSelectClip(clip.id, 'midi');
        setDragState({ clipId: clip.id, type: 'midi', startX: x, originalStart: clip.start, draggingPlayhead: false });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + canvas.parentElement!.scrollLeft;

    // Handle playhead dragging
    if (dragState.draggingPlayhead) {
      const deltaTime = (x - dragState.startX) / zoom;
      const newPosition = Math.max(0, dragState.originalStart + deltaTime);
      onSeek(newPosition);
      return;
    }

    // Handle clip dragging
    if (!dragState.clipId || !dragState.type) return;

    const deltaTime = (x - dragState.startX) / zoom;
    const newStart = Math.max(0, dragState.originalStart + deltaTime);

    if (dragState.type === 'audio') {
      onAudioClipMove(dragState.clipId, newStart);
    } else if (dragState.type === 'midi') {
      onMidiClipMove(dragState.clipId, newStart);
    }
  };

  const handleMouseUp = () => {
    setDragState({ clipId: null, type: null, startX: 0, originalStart: 0, draggingPlayhead: false });
  };

  const handleDoubleClick = (_e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedClipId) {
      const midiClip = state.midiClips[selectedClipId];
      if (midiClip) {
        onOpenMidiEditor(selectedClipId);
      }
    }
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        style={{
          cursor: dragState.draggingPlayhead ? 'grabbing' : dragState.clipId ? 'grabbing' : 'default',
          display: 'block'
        }}
      />
    </div>
  );
}
