/**
 * Recording manager - manages microphone input and recording state
 * Records audio from microphone to armed tracks
 */

export interface RecorderConfig {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  onRecordingFailed: (error: Error) => void;
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private startTime: number = 0;
  private config: RecorderConfig;
  private isRecording: boolean = false;

  constructor(config: RecorderConfig) {
    this.config = config;
  }

  /**
   * Start recording from microphone
   */
  async start(): Promise<void> {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.recordedChunks = [];
      this.startTime = performance.now();
      this.isRecording = true;

      // Collect data chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      // Handle stop
      this.mediaRecorder.onstop = () => {
        const duration = (performance.now() - this.startTime) / 1000;
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        console.log(`[Recording] Media recorder stopped. Chunks collected: ${this.recordedChunks.length}, Blob size: ${blob.size} bytes, Duration: ${duration.toFixed(2)}s`);
        
        if (blob.size === 0) {
          console.warn('[Recording] WARNING: Blob size is 0 - no audio data captured!');
        }
        
        this.config.onRecordingComplete(blob, duration);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        this.isRecording = false;
      };

      // Start recording
      this.mediaRecorder.start();
      console.log('[Recording] Started recording from microphone');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[Recording] Failed to start recording:', err);
      this.config.onRecordingFailed(err);
      this.isRecording = false;
    }
  }

  /**
   * Stop recording
   */
  stop(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      console.log('[Recording] Stopped recording');
    }
  }

  /**
   * Check if recording is active
   */
  isActive(): boolean {
    return this.isRecording;
  }
}

/**
 * Create recording functions for a component
 * Returns bound functions that can be called directly
 * getArmedTracks is called dynamically when recording starts
 */
export function createRecording(
  getArmedTracks: () => string[],
  onRecordingComplete: (blob: Blob, trackIds: string[], duration: number) => void
): { start: () => Promise<void>; stop: () => void } {
  let recorder: AudioRecorder | null = null;
  let currentArmedTracks: string[] = [];
  console.log('[Recording] createRecording called');

  return {
    start: async () => {
      console.log('[Recording] start() called');
      // Get armed tracks dynamically at the time of starting
      currentArmedTracks = getArmedTracks();
      console.log('[Recording] Current armed tracks:', currentArmedTracks);
      
      if (currentArmedTracks.length === 0) {
        console.warn('[Recording] No armed tracks available');
        return;
      }

      console.log('[Recording] Creating AudioRecorder instance...');
      recorder = new AudioRecorder({
        onRecordingComplete: (blob, duration) => {
          console.log('[Recording] AudioRecorder callback fired, calling onRecordingComplete');
          onRecordingComplete(blob, currentArmedTracks, duration);
        },
        onRecordingFailed: (error) => {
          console.error('[Recording] Error during recording:', error);
        },
      });

      console.log('[Recording] Calling recorder.start()...');
      await recorder.start();
      console.log('[Recording] recorder.start() completed');
    },
    stop: () => {
      console.log('[Recording] stop() called, recorder exists:', recorder !== null);
      if (recorder) {
        console.log('[Recording] Calling recorder.stop()...');
        recorder.stop();
      }
    },
  };
}
