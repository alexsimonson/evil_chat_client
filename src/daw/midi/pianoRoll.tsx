/**
 * Simple MIDI piano roll editor
 */

import React, { useState, useRef, useEffect } from 'react';
import type { MidiClip } from '../types';

interface PianoRollProps {
  clip: MidiClip;
  onAddNote: (time: number, midi: number, duration: number, velocity: number) => void;
  onMoveNote: (noteId: string, time: number, midi: number) => void;
  onResizeNote: (noteId: string, duration: number) => void;
  onDeleteNote: (noteId: string) => void;
  zoom: number; // pixels per second
}

const PIANO_KEYS = 88; // Standard piano: 88 keys (A0 to C8, MIDI 21-108)
const KEY_HEIGHT = 16;
const GRID_SNAP = 0.25; // Snap to 16th notes at 120 BPM

export function PianoRoll({ 
  clip, 
  onAddNote, 
  onMoveNote, 
  onResizeNote, 
  onDeleteNote,
  zoom,
}: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize' | null;
    noteId: string | null;
    startX: number;
    startY: number;
    originalTime: number;
    originalMidi: number;
    originalDuration: number;
  }>({ type: null, noteId: null, startX: 0, startY: 0, originalTime: 0, originalMidi: 0, originalDuration: 0 });

  // Draw piano roll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = clip.duration * zoom;
    const height = PIANO_KEYS * KEY_HEIGHT;

    canvas.width = width;
    canvas.height = height;

    // Clear
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);

    // Draw grid (beat lines)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    const beatDuration = 60 / 120; // 120 BPM
    for (let beat = 0; beat <= clip.duration; beat += beatDuration) {
      const x = beat * zoom;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw piano keys (horizontal lines)
    ctx.strokeStyle = '#2a2a2a';
    for (let i = 0; i <= PIANO_KEYS; i++) {
      const y = i * KEY_HEIGHT;
      // Highlight white keys
      const midiNote = 108 - i; // Top is high C
      const isWhiteKey = [0, 2, 4, 5, 7, 9, 11].includes(midiNote % 12);
      if (isWhiteKey) {
        ctx.fillStyle = '#252525';
        ctx.fillRect(0, y, width, KEY_HEIGHT);
      }
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw notes
    clip.notes.forEach((note) => {
      const x = note.time * zoom;
      const y = (108 - note.midi) * KEY_HEIGHT;
      const w = note.duration * zoom;
      const h = KEY_HEIGHT;

      // Note color
      const isSelected = note.id === selectedNoteId;
      ctx.fillStyle = isSelected ? '#4a9eff' : '#2a7fff';
      ctx.fillRect(x, y, w, h);

      // Note border
      ctx.strokeStyle = isSelected ? '#6bb6ff' : '#3a8fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    });
  }, [clip, zoom, selectedNoteId]);

  // Handle mouse down (add or select note)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const time = x / zoom;
    const midi = 108 - Math.floor(y / KEY_HEIGHT);

    // Check if clicking on existing note
    const clickedNote = clip.notes.find((note) => {
      const noteX = note.time * zoom;
      const noteY = (108 - note.midi) * KEY_HEIGHT;
      const noteW = note.duration * zoom;
      const noteH = KEY_HEIGHT;
      return x >= noteX && x <= noteX + noteW && y >= noteY && y <= noteY + noteH;
    });

    if (clickedNote) {
      setSelectedNoteId(clickedNote.id);
      
      // Check if near right edge (resize) or body (move)
      const noteX = clickedNote.time * zoom;
      const noteW = clickedNote.duration * zoom;
      const isNearEdge = x > noteX + noteW - 5;

      if (isNearEdge) {
        setDragState({
          type: 'resize',
          noteId: clickedNote.id,
          startX: x,
          startY: y,
          originalTime: clickedNote.time,
          originalMidi: clickedNote.midi,
          originalDuration: clickedNote.duration,
        });
      } else {
        setDragState({
          type: 'move',
          noteId: clickedNote.id,
          startX: x,
          startY: y,
          originalTime: clickedNote.time,
          originalMidi: clickedNote.midi,
          originalDuration: clickedNote.duration,
        });
      }
    } else {
      // Add new note
      const snappedTime = Math.round(time / GRID_SNAP) * GRID_SNAP;
      const defaultDuration = GRID_SNAP;
      onAddNote(Math.max(0, snappedTime), Math.max(0, Math.min(127, midi)), defaultDuration, 80);
    }
  };

  // Handle mouse move (drag)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState.type || !dragState.noteId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (dragState.type === 'move') {
      const deltaTime = (x - dragState.startX) / zoom;
      const deltaMidi = Math.round((dragState.startY - y) / KEY_HEIGHT);

      const newTime = Math.max(0, dragState.originalTime + deltaTime);
      const newMidi = Math.max(0, Math.min(127, dragState.originalMidi + deltaMidi));

      const snappedTime = Math.round(newTime / GRID_SNAP) * GRID_SNAP;

      onMoveNote(dragState.noteId, snappedTime, newMidi);
    } else if (dragState.type === 'resize') {
      const deltaTime = (x - dragState.startX) / zoom;
      const newDuration = Math.max(GRID_SNAP, dragState.originalDuration + deltaTime);
      const snappedDuration = Math.round(newDuration / GRID_SNAP) * GRID_SNAP;

      onResizeNote(dragState.noteId, snappedDuration);
    }
  };

  // Handle mouse up (end drag)
  const handleMouseUp = () => {
    setDragState({ type: null, noteId: null, startX: 0, startY: 0, originalTime: 0, originalMidi: 0, originalDuration: 0 });
  };

  // Handle delete key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteId) {
        onDeleteNote(selectedNoteId);
        setSelectedNoteId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteId, onDeleteNote]);

  return (
    <div style={{ overflow: 'auto', background: '#1a1a1a', height: '400px' }}>
      <div style={{ padding: '10px', color: '#ccc', fontSize: '12px' }}>
        Piano Roll: {clip.id} | Click to add notes, drag to move, right edge to resize, Delete to remove
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: dragState.type ? 'grabbing' : 'crosshair', display: 'block' }}
      />
    </div>
  );
}
