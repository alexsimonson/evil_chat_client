/**
 * Operation definitions for DAW collaborative editing
 */

import { z } from 'zod';

// Base operation schema
export const BaseOpSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  timestamp: z.number(),
  baseVersion: z.number(),
});

// Track operations
export const TrackAddOpSchema = BaseOpSchema.extend({
  type: z.literal('TRACK_ADD'),
  trackId: z.string(),
  trackType: z.enum(['audio', 'midi']),
  name: z.string(),
  sortOrder: z.number(),
});

export const TrackRemoveOpSchema = BaseOpSchema.extend({
  type: z.literal('TRACK_REMOVE'),
  trackId: z.string(),
});

export const TrackRenameOpSchema = BaseOpSchema.extend({
  type: z.literal('TRACK_RENAME'),
  trackId: z.string(),
  name: z.string(),
});

export const TrackSetVolumeOpSchema = BaseOpSchema.extend({
  type: z.literal('TRACK_SET_VOLUME'),
  trackId: z.string(),
  volume: z.number().min(0).max(1),
});


// Audio asset operations
export const AudioAssetAddOpSchema = BaseOpSchema.extend({
  type: z.literal('AUDIO_ASSET_ADD'),
  assetId: z.string(),
  url: z.string(),
  duration: z.number(),
  name: z.string(),
});

// Audio clip operations
export const AudioClipAddOpSchema = BaseOpSchema.extend({
  type: z.literal('AUDIO_CLIP_ADD'),
  clipId: z.string(),
  trackId: z.string(),
  assetId: z.string(),
  start: z.number(),
  duration: z.number(),
  gain: z.number().min(0).max(1).default(1),
  offset: z.number().default(0),
});

export const AudioClipMoveOpSchema = BaseOpSchema.extend({
  type: z.literal('AUDIO_CLIP_MOVE'),
  clipId: z.string(),
  start: z.number(),
  trackId: z.string().optional(), // allow moving to different track
});

export const AudioClipResizeOpSchema = BaseOpSchema.extend({
  type: z.literal('AUDIO_CLIP_RESIZE'),
  clipId: z.string(),
  duration: z.number(),
  offset: z.number().optional(),
});

export const AudioClipDeleteOpSchema = BaseOpSchema.extend({
  type: z.literal('AUDIO_CLIP_DELETE'),
  clipId: z.string(),
});

// MIDI clip operations
export const MidiClipAddOpSchema = BaseOpSchema.extend({
  type: z.literal('MIDI_CLIP_ADD'),
  clipId: z.string(),
  trackId: z.string(),
  start: z.number(),
  duration: z.number(),
});

export const MidiClipMoveOpSchema = BaseOpSchema.extend({
  type: z.literal('MIDI_CLIP_MOVE'),
  clipId: z.string(),
  start: z.number(),
  trackId: z.string().optional(),
});

export const MidiClipResizeOpSchema = BaseOpSchema.extend({
  type: z.literal('MIDI_CLIP_RESIZE'),
  clipId: z.string(),
  duration: z.number(),
});

export const MidiClipDeleteOpSchema = BaseOpSchema.extend({
  type: z.literal('MIDI_CLIP_DELETE'),
  clipId: z.string(),
});

// MIDI note operations
export const MidiNoteAddOpSchema = BaseOpSchema.extend({
  type: z.literal('MIDI_NOTE_ADD'),
  clipId: z.string(),
  noteId: z.string(),
  time: z.number(),
  duration: z.number(),
  midi: z.number().min(0).max(127),
  velocity: z.number().min(0).max(127).default(80),
});

export const MidiNoteMoveOpSchema = BaseOpSchema.extend({
  type: z.literal('MIDI_NOTE_MOVE'),
  clipId: z.string(),
  noteId: z.string(),
  time: z.number(),
  midi: z.number().min(0).max(127),
});

export const MidiNoteResizeOpSchema = BaseOpSchema.extend({
  type: z.literal('MIDI_NOTE_RESIZE'),
  clipId: z.string(),
  noteId: z.string(),
  duration: z.number(),
});

export const MidiNoteDeleteOpSchema = BaseOpSchema.extend({
  type: z.literal('MIDI_NOTE_DELETE'),
  clipId: z.string(),
  noteId: z.string(),
});

// Transport operations
export const TransportSetBpmOpSchema = BaseOpSchema.extend({
  type: z.literal('TRANSPORT_SET_BPM'),
  bpm: z.number().min(20).max(300),
});

// Project operations
export const ProjectResetOpSchema = BaseOpSchema.extend({
  type: z.literal('PROJECT_RESET'),
});

// Union of all operations
export const DawOpSchema = z.discriminatedUnion('type', [
  TrackAddOpSchema,
  TrackRemoveOpSchema,
  TrackRenameOpSchema,
  TrackSetVolumeOpSchema,
  AudioAssetAddOpSchema,
  AudioClipAddOpSchema,
  AudioClipMoveOpSchema,
  AudioClipResizeOpSchema,
  AudioClipDeleteOpSchema,
  MidiClipAddOpSchema,
  MidiClipMoveOpSchema,
  MidiClipResizeOpSchema,
  MidiClipDeleteOpSchema,
  MidiNoteAddOpSchema,
  MidiNoteMoveOpSchema,
  MidiNoteResizeOpSchema,
  MidiNoteDeleteOpSchema,
  TransportSetBpmOpSchema,
  ProjectResetOpSchema,
]);

export type DawOp = z.infer<typeof DawOpSchema>;
export type TrackAddOp = z.infer<typeof TrackAddOpSchema>;
export type TrackRemoveOp = z.infer<typeof TrackRemoveOpSchema>;
export type TrackRenameOp = z.infer<typeof TrackRenameOpSchema>;
export type TrackSetVolumeOp = z.infer<typeof TrackSetVolumeOpSchema>;
export type AudioAssetAddOp = z.infer<typeof AudioAssetAddOpSchema>;
export type AudioClipAddOp = z.infer<typeof AudioClipAddOpSchema>;
export type AudioClipMoveOp = z.infer<typeof AudioClipMoveOpSchema>;
export type AudioClipResizeOp = z.infer<typeof AudioClipResizeOpSchema>;
export type AudioClipDeleteOp = z.infer<typeof AudioClipDeleteOpSchema>;
export type MidiClipAddOp = z.infer<typeof MidiClipAddOpSchema>;
export type MidiClipMoveOp = z.infer<typeof MidiClipMoveOpSchema>;
export type MidiClipResizeOp = z.infer<typeof MidiClipResizeOpSchema>;
export type MidiClipDeleteOp = z.infer<typeof MidiClipDeleteOpSchema>;
export type MidiNoteAddOp = z.infer<typeof MidiNoteAddOpSchema>;
export type MidiNoteMoveOp = z.infer<typeof MidiNoteMoveOpSchema>;
export type MidiNoteResizeOp = z.infer<typeof MidiNoteResizeOpSchema>;
export type MidiNoteDeleteOp = z.infer<typeof MidiNoteDeleteOpSchema>;
export type TransportSetBpmOp = z.infer<typeof TransportSetBpmOpSchema>;
export type ProjectResetOp = z.infer<typeof ProjectResetOpSchema>;
