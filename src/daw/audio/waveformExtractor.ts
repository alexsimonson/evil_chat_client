/**
 * Waveform extraction utility
 * Decodes audio blobs and extracts PCM waveform data for visualization
 */

/**
 * Extract waveform data from an audio blob
 * Returns Float32Array[] containing [left, right] channels or [mono] if mono
 * Uses downsampling for large files to keep data manageable
 */
export async function extractWaveformData(
  audioBlob: Blob,
  options?: {
    maxSamples?: number; // Target max samples per channel (default 4096)
  }
): Promise<Float32Array[]> {
  const maxSamples = options?.maxSamples ?? 4096;

  try {
    console.log(`[Waveform] Starting extraction from blob size ${audioBlob.size} bytes`);
    
    // Decode audio blob
    const audioBuffer = await decodeAudioBlob(audioBlob);
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    console.log(`[Waveform] AudioBuffer decoded: ${numChannels} channels, ${sampleRate}Hz, ${length} samples (${(length / sampleRate).toFixed(2)}s)`);

    // Calculate downsample ratio
    const downsampleRatio = Math.max(1, Math.ceil(length / maxSamples));

    // Extract channel data with downsampling
    const waveformData: Float32Array[] = [];
    for (let channel = 0; channel < numChannels; channel++) {
      const sourceData = audioBuffer.getChannelData(channel);
      const downsampled = downsampleAudio(sourceData, downsampleRatio);
      waveformData.push(downsampled);
      console.log(`[Waveform] Channel ${channel}: ${downsampled.length} samples after downsampling`);
    }

    console.log(
      `[Waveform] Extraction complete! ${numChannels}-channel, ${waveformData[0].length} samples per channel`
    );

    return waveformData;
  } catch (error) {
    console.error('[Waveform] Extraction failed:', error);
    throw error;
  }
}

/**
 * Decode an audio blob to AudioBuffer
 */
async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioContext.decodeAudioData(arrayBuffer);
}

/**
 * Downsample audio data using peak detection
 * Preserves peaks for better visualization of quiet audio
 */
function downsampleAudio(data: Float32Array, ratio: number): Float32Array {
  if (ratio <= 1) return data;

  const downsampled: number[] = [];

  for (let i = 0; i < data.length; i += ratio) {
    const chunkEnd = Math.min(i + ratio, data.length);
    let min = data[i];
    let max = data[i];

    // Find min and max in this chunk to preserve peaks
    for (let j = i; j < chunkEnd; j++) {
      if (data[j] < min) min = data[j];
      if (data[j] > max) max = data[j];
    }

    // Store both min and max for better visualization
    downsampled.push(min);
    downsampled.push(max);
  }

  return new Float32Array(downsampled);
}

/**
 * Calculate visual bounds for waveform rendering
 * Returns [minValue, maxValue] to determine canvas height scaling
 */
export function calculateWaveformBounds(waveformData: Float32Array[]): { min: number; max: number } {
  let min = 0;
  let max = 0;

  for (const channel of waveformData) {
    for (let i = 0; i < channel.length; i++) {
      min = Math.min(min, channel[i]);
      max = Math.max(max, channel[i]);
    }
  }

  // Ensure we have some range
  if (max === 0 || (min === max && max === 0)) {
    max = 1;
  }

  return { min, max };
}

/**
 * Generate a color for a waveform based on channel
 */
export function getWaveformColor(channelIndex: number, isSelected: boolean): string {
  if (isSelected) {
    // Bright colors for selected waveforms
    return channelIndex === 0 ? '#4ff' : '#4f4'; // Cyan for left, lime for right
  }

  // Subtle colors for unselected waveforms
  return channelIndex === 0 ? '#0ff' : '#0f0'; // Darker cyan and green
}
