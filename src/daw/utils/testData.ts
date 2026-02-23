/**
 * Utility to create test data for DAW
 */

import type { DawOp } from '../state/ops';

const generateId = () => Math.random().toString(36).substring(2, 15);

/**
 * Generate operations to create a simple test project
 */
export function createTestProject(clientId: string, _projectId: string): DawOp[] {
  const ops: DawOp[] = [];
  let version = 0;

  // Add an audio track
  const audioTrackId = generateId();
  ops.push({
    id: generateId(),
    clientId,
    timestamp: Date.now(),
    baseVersion: version++,
    type: 'TRACK_ADD',
    trackId: audioTrackId,
    trackType: 'audio',
    name: 'Audio Track 1',
    sortOrder: 0,
  });

  // Add a MIDI track
  const midiTrackId = generateId();
  ops.push({
    id: generateId(),
    clientId,
    timestamp: Date.now(),
    baseVersion: version++,
    type: 'TRACK_ADD',
    trackId: midiTrackId,
    trackType: 'midi',
    name: 'MIDI Track 1',
    sortOrder: 1,
  });

  // Add a MIDI clip
  const midiClipId = generateId();
  ops.push({
    id: generateId(),
    clientId,
    timestamp: Date.now(),
    baseVersion: version++,
    type: 'MIDI_CLIP_ADD',
    clipId: midiClipId,
    trackId: midiTrackId,
    start: 0,
    duration: 8, // 8 seconds
  });

  // Add some MIDI notes (C major scale)
  const cMajorScale = [60, 62, 64, 65, 67, 69, 71, 72]; // C4 to C5
  cMajorScale.forEach((midi, index) => {
    ops.push({
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: version++,
      type: 'MIDI_NOTE_ADD',
      clipId: midiClipId,
      noteId: generateId(),
      time: index * 0.5, // Each note 0.5 seconds apart
      duration: 0.4,
      midi,
      velocity: 80,
    });
  });

  return ops;
}

/**
 * Example: Create a drum pattern
 */
export function createDrumPattern(clientId: string, _trackId: string, clipId: string, startVersion: number): DawOp[] {
  const ops: DawOp[] = [];
  let version = startVersion;

  // Kick on 1 and 3
  [0, 2].forEach((beat) => {
    ops.push({
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: version++,
      type: 'MIDI_NOTE_ADD',
      clipId,
      noteId: generateId(),
      time: beat * 0.5,
      duration: 0.1,
      midi: 36, // C1 - Kick
      velocity: 100,
    });
  });

  // Snare on 2 and 4
  [1, 3].forEach((beat) => {
    ops.push({
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: version++,
      type: 'MIDI_NOTE_ADD',
      clipId,
      noteId: generateId(),
      time: beat * 0.5,
      duration: 0.1,
      midi: 38, // D1 - Snare
      velocity: 90,
    });
  });

  // Hi-hats every 8th note
  [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75].forEach((time) => {
    ops.push({
      id: generateId(),
      clientId,
      timestamp: Date.now(),
      baseVersion: version++,
      type: 'MIDI_NOTE_ADD',
      clipId,
      noteId: generateId(),
      time,
      duration: 0.1,
      midi: 42, // F#1 - Closed Hi-hat
      velocity: 70,
    });
  });

  return ops;
}

/**
 * Console helper to apply test ops in browser console
 */
export function applyTestData() {
  console.log('To test the DAW, create a project first, then open the browser console and run:');
  console.log('');
  console.log('// Get a reference to the DAW state dispatcher');
  console.log('// (You would need to expose this from ProjectDawPage for testing)');
  console.log('');
  console.log('Example ops:', createTestProject('test-client', 'test-project'));
}
