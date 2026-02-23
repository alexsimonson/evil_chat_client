/**
 * Main timeline component - renders audio and MIDI clips
 */

import React, { useRef, useEffect } from 'react';
import type { DawState, AudioClip, MidiClip, Track } from '../types';
import { calculateWaveformBounds, getWaveformColor } from '../audio/waveformExtractor';

interface TimelineProps {
  state: DawState;
  playheadSeconds: number;
  isPlaying: boolean;
  zoom: number; // pixels per second
  selectedClipId: string | null;
  onSelectClip: (clipId: string, type: 'audio' | 'midi') => void;
  onAudioClipMove: (clipId: string, newStart: number) => void;
  onMidiClipMove: (clipId: string, newStart: number) => void;
  onOpenMidiEditor: (clipId: string) => void;
  onSeek: (positionSeconds: number) => void;
  waveformDataMap?: Map<string, Float32Array[]>; // assetId -> waveform data
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  horizontalScrollRef?: React.RefObject<HTMLDivElement | null>;
  verticalScrollRef?: React.RefObject<HTMLDivElement | null>;
}

export function Timeline({
  state,
  playheadSeconds,
  isPlaying: _isPlaying,
  zoom,
  selectedClipId,
  onSelectClip,
  onAudioClipMove,
  onMidiClipMove,
  onOpenMidiEditor,
  onSeek,
  waveformDataMap,
  scrollContainerRef,
  horizontalScrollRef,
  verticalScrollRef,
}: TimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragState, setDragState] = React.useState<{
    clipId: string | null;
    type: 'audio' | 'midi' | null;
    startX: number;
    originalStart: number;
    tempStart: number; // Current position during drag (for visual feedback)
    draggingPlayhead: boolean;
    draggingBackground: boolean;
    scrollStartLeft: number;
  }>({
    clipId: null,
    type: null,
    startX: 0,
    originalStart: 0,
    tempStart: 0,
    draggingPlayhead: false,
    draggingBackground: false,
    scrollStartLeft: 0,
  });

  const tracks = state.trackOrder.map((id) => state.tracks[id]);
  const TRACK_HEIGHT = 80;

  useEffect(() => {
    drawTimeline();
  }, [state, zoom, selectedClipId, playheadSeconds, waveformDataMap, dragState]);

  const getScrollOffsets = () => {
    const container = scrollContainerRef?.current ?? canvasRef.current?.parentElement;
    return {
      left: horizontalScrollRef?.current?.scrollLeft ?? container?.scrollLeft ?? 0,
      top: verticalScrollRef?.current?.scrollTop ?? container?.scrollTop ?? 0,
    };
  };

  const getScrollContainer = () => horizontalScrollRef?.current ?? scrollContainerRef?.current ?? canvasRef.current?.parentElement;

  const drawTimeline = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const duration = 300; // Show 300 seconds (5 minutes) by default
    const width = Math.max(duration * zoom, canvas.clientWidth);
    const height = tracks.length * TRACK_HEIGHT;

    canvas.width = width;
    canvas.height = height;

    // Clear
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw tracks (no time ruler - it's in the fixed header above)
    tracks.forEach((track, index) => {
      drawTrack(ctx, track, index);
    });

    // Draw playhead
    const playheadX = playheadSeconds * zoom;
    ctx.strokeStyle = '#ff4a4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
  };

  const drawTrack = (ctx: CanvasRenderingContext2D, track: Track, index: number) => {
    const y = index * TRACK_HEIGHT;

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
        .forEach((clip) => drawAudioClip(ctx, clip, y, dragState));
    } else if (track.type === 'midi') {
      Object.values(state.midiClips)
        .filter((clip) => clip.trackId === track.id)
        .forEach((clip) => drawMidiClip(ctx, clip, y, dragState));
    }
  };

  const drawAudioClip = (ctx: CanvasRenderingContext2D, clip: AudioClip, trackY: number, dragState: any) => {
    // Use tempStart if this clip is being dragged, otherwise use the stored start position
    const clipStart = dragState.clipId === clip.id && dragState.type === 'audio' ? dragState.tempStart : clip.start;
    const x = clipStart * zoom;
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

    // Draw waveform
    const waveformData = waveformDataMap?.get(clip.assetId);
    if (waveformData && waveformData.length > 0) {
      console.log(`[Timeline] Drawing waveform for asset ${clip.assetId}, channels: ${waveformData.length}, samples: ${waveformData[0].length}`);
      drawWaveform(ctx, waveformData, x, y, w, h, isSelected);
    } else {
      console.log(`[Timeline] No waveform data for asset ${clip.assetId}, using placeholder`);
      // Fallback to placeholder if no waveform data
      ctx.strokeStyle = '#5af';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const amplitude = h / 4;
      const centerY = y + h / 2;
      for (let i = 0; i < w; i += 2) {
        const waveY = centerY + Math.sin(i * 0.1) * amplitude;
        if (i === 0) {
          ctx.moveTo(x + i, waveY);
        } else {
          ctx.lineTo(x + i, waveY);
        }
      }
      ctx.stroke();
    }
  };

  const drawWaveform = (
    ctx: CanvasRenderingContext2D,
    waveformData: Float32Array[],
    x: number,
    y: number,
    w: number,
    h: number,
    isSelected: boolean
  ) => {
    const bounds = calculateWaveformBounds(waveformData);
    const centerY = y + h / 2;
    const pixelsPerSample = w / (waveformData[0]?.length ?? 1);

    // Draw each channel
    waveformData.forEach((channelData, channelIndex) => {
      if (!channelData || channelData.length === 0) return;

      const color = getWaveformColor(channelIndex, isSelected);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;

      // Calculate vertical scaling
      const range = Math.max(Math.abs(bounds.min), Math.abs(bounds.max), 0.01);
      const scale = (h / 2 - 2) / range; // Leave 2px padding

      ctx.beginPath();
      let isFirstPoint = true;

      for (let i = 0; i < channelData.length; i++) {
        const sample = channelData[i];
        const pixelX = x + i * pixelsPerSample;
        const pixelY = centerY - sample * scale;

        // Skip drawing if off-screen left
        if (pixelX < x) continue;
        // Stop drawing if off-screen right
        if (pixelX > x + w) break;

        if (isFirstPoint) {
          ctx.moveTo(pixelX, pixelY);
          isFirstPoint = false;
        } else {
          ctx.lineTo(pixelX, pixelY);
        }
      }

      ctx.stroke();
    });
  };

  const drawMidiClip = (ctx: CanvasRenderingContext2D, clip: MidiClip, trackY: number, dragState: any) => {
    // Use tempStart if this clip is being dragged, otherwise use the stored start position
    const clipStart = dragState.clipId === clip.id && dragState.type === 'midi' ? dragState.tempStart : clip.start;
    const x = clipStart * zoom;
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
    const scroll = getScrollOffsets();
    const x = e.clientX - rect.left + scroll.left;
    const y = e.clientY - rect.top + scroll.top;

    // Check playhead click tolerance (5 pixels on either side)
    const playheadX = playheadSeconds * zoom;
    if (Math.abs(x - playheadX) < 10) {
      // Clicked on playhead - start dragging it
      setDragState({
        clipId: null,
        type: null,
        startX: x,
        originalStart: playheadSeconds,
        tempStart: playheadSeconds,
        draggingPlayhead: true,
        draggingBackground: false,
        scrollStartLeft: 0,
      });
      return;
    }

    // Check if clicking on a clip
    const trackIndex = Math.floor(y / TRACK_HEIGHT);
    if (trackIndex < 0 || trackIndex >= tracks.length) return;

    const track = tracks[trackIndex];
    const clickTime = x / zoom;

    if (track.type === 'audio') {
      const clip = Object.values(state.audioClips).find(
        (c) => c.trackId === track.id && clickTime >= c.start && clickTime <= c.start + c.duration
      );
      if (clip) {
        onSelectClip(clip.id, 'audio');
        setDragState({
          clipId: clip.id,
          type: 'audio',
          startX: x,
          originalStart: clip.start,
          tempStart: clip.start,
          draggingPlayhead: false,
          draggingBackground: false,
          scrollStartLeft: 0,
        });
        return;
      }
    } else if (track.type === 'midi') {
      const clip = Object.values(state.midiClips).find(
        (c) => c.trackId === track.id && clickTime >= c.start && clickTime <= c.start + c.duration
      );
      if (clip) {
        onSelectClip(clip.id, 'midi');
        setDragState({
          clipId: clip.id,
          type: 'midi',
          startX: x,
          originalStart: clip.start,
          tempStart: clip.start,
          draggingPlayhead: false,
          draggingBackground: false,
          scrollStartLeft: 0,
        });
        return;
      }
    }

    // Background drag to pan timeline
    const container = getScrollContainer();
    if (container) {
      setDragState({
        clipId: null,
        type: null,
        startX: x,
        originalStart: 0,
        tempStart: 0,
        draggingPlayhead: false,
        draggingBackground: true,
        scrollStartLeft: container.scrollLeft,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scroll = getScrollOffsets();
    const x = e.clientX - rect.left + scroll.left;

    // Handle playhead dragging
    if (dragState.draggingPlayhead) {
      const deltaTime = (x - dragState.startX) / zoom;
      const newPosition = Math.max(0, dragState.originalStart + deltaTime);
      onSeek(newPosition);
      return;
    }

    // Handle background drag for panning
    if (dragState.draggingBackground) {
      const container = getScrollContainer();
      if (container) {
        const deltaX = x - dragState.startX;
        container.scrollLeft = Math.max(0, dragState.scrollStartLeft - deltaX);
      }
      return;
    }

    // Handle clip dragging - just update tempStart for visual feedback, don't send to server yet
    if (!dragState.clipId || !dragState.type) return;

    const deltaTime = (x - dragState.startX) / zoom;
    const newStart = Math.max(0, dragState.originalStart + deltaTime);

    // Update tempStart to show visual feedback during drag
    // This state change will trigger the useEffect to redraw the timeline
    setDragState({
      ...dragState,
      tempStart: newStart,
    });
  };

  const handleMouseUp = () => {
    // Send the final position to the server only when drag is complete
    if (dragState.clipId && dragState.type) {
      if (dragState.type === 'audio') {
        onAudioClipMove(dragState.clipId, dragState.tempStart);
      } else if (dragState.type === 'midi') {
        onMidiClipMove(dragState.clipId, dragState.tempStart);
      }
    }

    setDragState({
      clipId: null,
      type: null,
      startX: 0,
      originalStart: 0,
      tempStart: 0,
      draggingPlayhead: false,
      draggingBackground: false,
      scrollStartLeft: 0,
    });
  };

  // Helper to get coordinates from mouse or touch events
  const getCoordinatesFromEvent = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX: number;
    let clientY: number;

    if ('touches' in e) {
      // Touch event
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left + getScrollOffsets().left,
      y: clientY - rect.top + getScrollOffsets().top,
    };
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCoordinatesFromEvent(e);
    if (!coords) return;
    
    // Create a synthetic mouse event-like interface
    const syntheticEvent = { clientX: coords.x + (canvasRef.current?.getBoundingClientRect().left ?? 0), clientY: coords.y + (canvasRef.current?.getBoundingClientRect().top ?? 0) };
    handleMouseDown(syntheticEvent as any);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCoordinatesFromEvent(e);
    if (!coords) return;
    
    // Prevent default scrolling behavior when dragging a clip
    if (dragState.clipId || dragState.draggingPlayhead || dragState.draggingBackground) {
      e.preventDefault();
    }

    const x = coords.x;

    // Handle playhead dragging
    if (dragState.draggingPlayhead) {
      const deltaTime = (x - dragState.startX) / zoom;
      const newPosition = Math.max(0, dragState.originalStart + deltaTime);
      onSeek(newPosition);
      return;
    }

    // Handle background drag for panning
    if (dragState.draggingBackground) {
      const container = getScrollContainer();
      if (container) {
        const deltaX = x - dragState.startX;
        container.scrollLeft = Math.max(0, dragState.scrollStartLeft - deltaX);
      }
      return;
    }

    // Handle clip dragging - just update tempStart for visual feedback, don't send to server yet
    if (!dragState.clipId || !dragState.type) return;

    const deltaTime = (x - dragState.startX) / zoom;
    const newStart = Math.max(0, dragState.originalStart + deltaTime);

    // Update tempStart to show visual feedback during drag
    setDragState({
      ...dragState,
      tempStart: newStart,
    });
  };

  const handleTouchEnd = (_e: React.TouchEvent<HTMLCanvasElement>) => {
    // Send the final position to the server only when drag is complete
    if (dragState.clipId && dragState.type) {
      if (dragState.type === 'audio') {
        onAudioClipMove(dragState.clipId, dragState.tempStart);
      } else if (dragState.type === 'midi') {
        onMidiClipMove(dragState.clipId, dragState.tempStart);
      }
    }

    setDragState({
      clipId: null,
      type: null,
      startX: 0,
      originalStart: 0,
      tempStart: 0,
      draggingPlayhead: false,
      draggingBackground: false,
      scrollStartLeft: 0,
    });
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
    <div style={{ flex: 1, position: 'relative', touchAction: 'none', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        style={{
          cursor: dragState.draggingPlayhead || dragState.clipId || dragState.draggingBackground ? 'grabbing' : 'grab',
          display: 'block'
        }}
      />
    </div>
  );
}
