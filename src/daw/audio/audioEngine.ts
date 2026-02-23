/**
 * Audio engine using Tone.js
 * Handles transport, scheduling, audio playback, and MIDI synthesis
 */

import * as Tone from 'tone';
import type { DawState, AudioClip, MidiClip } from '../types';

export class AudioEngine {
  private synths: Map<string, Tone.PolySynth> = new Map(); // One synth per MIDI track
  private players: Map<string, Tone.Player> = new Map(); // Audio players for clips
  private scheduledEvents: Map<string, number[]> = new Map(); // Track scheduled Tone.js event IDs

  constructor() {
    // Initialize transport
    Tone.getTransport().loop = false;
    Tone.getTransport().PPQ = 480; // Pulses per quarter note
  }

  /**
   * Start playback
   */
  async start(state: DawState, positionSeconds: number = 0) {
    await Tone.start(); // Resume audio context
    
    // Set BPM
    Tone.getTransport().bpm.value = state.transport.bpm;
    
    // Set position
    Tone.getTransport().seconds = positionSeconds;
    
    // Schedule all clips
    this.scheduleAllClips(state);
    
    // Start transport
    Tone.getTransport().start();
  }

  /**
   * Pause playback
   */
  pause() {
    Tone.getTransport().pause();
  }

  /**
   * Stop playback and return to start
   */
  stop() {
    Tone.getTransport().stop();
    this.clearScheduledEvents();
  }

  /**
   * Seek to a specific position
   */
  seek(seconds: number) {
    Tone.getTransport().seconds = seconds;
  }

  /**
   * Set BPM
   */
  setBpm(bpm: number) {
    Tone.getTransport().bpm.value = bpm;
  }

  /**
   * Get current transport position in seconds
   */
  getPosition(): number {
    return Tone.getTransport().seconds;
  }

  /**
   * Check if playing
   */
  isPlaying(): boolean {
    return Tone.getTransport().state === 'started';
  }

  /**
   * Schedule all audio and MIDI clips
   */
  private scheduleAllClips(state: DawState) {
    this.clearScheduledEvents();

    // Schedule audio clips
    Object.values(state.audioClips).forEach((clip) => {
      this.scheduleAudioClip(clip, state);
    });

    // Schedule MIDI clips
    Object.values(state.midiClips).forEach((clip) => {
      this.scheduleMidiClip(clip, state);
    });
  }

  /**
   * Schedule a single audio clip
   */
  private scheduleAudioClip(clip: AudioClip, state: DawState) {
    const asset = state.audioAssets[clip.assetId];
    if (!asset) return;

    const track = state.tracks[clip.trackId];
    if (!track || track.mute) return;

    // Check if any track is soloed
    const anySolo = Object.values(state.tracks).some((t) => t.solo);
    if (anySolo && !track.solo) return;

    // Create or get player
    let player = this.players.get(clip.id);
    if (!player) {
      player = new Tone.Player(asset.url).toDestination();
      this.players.set(clip.id, player);
    }

    // Set volume
    player.volume.value = Tone.gainToDb(clip.gain * track.volume);

    // Schedule playback
    const eventId = Tone.getTransport().schedule((time) => {
      player!.start(time, clip.offset, clip.duration);
    }, clip.start);

    // Track event for cleanup
    const events = this.scheduledEvents.get(clip.id) || [];
    events.push(eventId);
    this.scheduledEvents.set(clip.id, events);
  }

  /**
   * Schedule a single MIDI clip
   */
  private scheduleMidiClip(clip: MidiClip, state: DawState) {
    const track = state.tracks[clip.trackId];
    if (!track || track.mute || track.type !== 'midi') return;

    // Check if any track is soloed
    const anySolo = Object.values(state.tracks).some((t) => t.solo);
    if (anySolo && !track.solo) return;

    // Create or get synth for this track
    let synth = this.synths.get(clip.trackId);
    if (!synth) {
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.005,
          decay: 0.1,
          sustain: 0.3,
          release: 1,
        },
      }).toDestination();
      this.synths.set(clip.trackId, synth);
    }

    // Set volume
    synth.volume.value = Tone.gainToDb(track.volume);

    // Schedule each note
    const events: number[] = [];
    clip.notes.forEach((note) => {
      const noteTime = clip.start + note.time;
      const noteName = Tone.Frequency(note.midi, 'midi').toNote();
      const velocity = note.velocity / 127;

      const eventId = Tone.getTransport().schedule((time) => {
        synth!.triggerAttackRelease(noteName, note.duration, time, velocity);
      }, noteTime);

      events.push(eventId);
    });

    // Track events for cleanup
    this.scheduledEvents.set(clip.id, events);
  }

  /**
   * Clear all scheduled events
   */
  private clearScheduledEvents() {
    this.scheduledEvents.forEach((events) => {
      events.forEach((eventId) => {
        Tone.getTransport().clear(eventId);
      });
    });
    this.scheduledEvents.clear();
  }

  /**
   * Update a specific clip's scheduling (when edited)
   */
  updateClip(clipId: string, state: DawState) {
    // Clear existing events for this clip
    const events = this.scheduledEvents.get(clipId);
    if (events) {
      events.forEach((eventId) => Tone.getTransport().clear(eventId));
      this.scheduledEvents.delete(clipId);
    }

    // Reschedule
    const audioClip = state.audioClips[clipId];
    if (audioClip) {
      this.scheduleAudioClip(audioClip, state);
      return;
    }

    const midiClip = state.midiClips[clipId];
    if (midiClip) {
      this.scheduleMidiClip(midiClip, state);
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.stop();
    this.players.forEach((player) => player.dispose());
    this.synths.forEach((synth) => synth.dispose());
    this.players.clear();
    this.synths.clear();
  }
}

// Singleton instance
let audioEngine: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!audioEngine) {
    audioEngine = new AudioEngine();
  }
  return audioEngine;
}
