/**
 * Transport bar component - playback controls
 */


import type { Transport } from '../types';

interface TransportBarProps {
  transport: Transport;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRecord: () => void;
  onSeek: (seconds: number) => void;
  onSetBpm: (bpm: number) => void;
  onReset: () => void;
}

export function TransportBar({
  transport,
  onPlay,
  onPause,
  onStop,
  onRecord,
  onSeek,
  onSetBpm,
  onReset,
}: TransportBarProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 20px',
        background: '#2a2a2a',
        borderBottom: '1px solid #444',
        color: '#fff',
      }}
    >
      {/* Play/Pause/Stop buttons */}
      <div style={{ display: 'flex', gap: '5px' }}>
        {!transport.isPlaying ? (
          <button
            onClick={onPlay}
            style={{
              padding: '8px 16px',
              background: '#4a9eff',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            ▶ Play
          </button>
        ) : (
          <button
            onClick={onPause}
            style={{
              padding: '8px 16px',
              background: '#ff9e4a',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            ⏸ Pause
          </button>
        )}
        <button
          onClick={onStop}
          style={{
            padding: '8px 16px',
            background: '#555',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          ⏹ Stop
        </button>
        <button
          onClick={onRecord}
          style={{
            padding: '8px 16px',
            background: transport.isRecording ? '#ff4a4a' : '#555',
            border: transport.isRecording ? '2px solid #fff' : 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: transport.isRecording ? 'bold' : 'normal',
          }}
          title="Toggle recording"
        >
          ● REC
        </button>
        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to reset the project? This cannot be undone.')) {
              onReset();
            }
          }}
          style={{
            padding: '8px 16px',
            background: '#8b4513',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
          }}
          title="Reset project to fresh state"
        >
          ↻ Reset
        </button>
      </div>

      {/* Position display */}
      <div
        style={{
          padding: '8px 12px',
          background: '#1a1a1a',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '14px',
        }}
      >
        {formatTime(transport.positionSeconds)}
      </div>

      {/* BPM control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <label style={{ fontSize: '12px', color: '#aaa' }}>BPM:</label>
        <input
          type="number"
          value={transport.bpm}
          onChange={(e) => onSetBpm(Number(e.target.value))}
          min={20}
          max={300}
          style={{
            width: '60px',
            padding: '6px',
            background: '#1a1a1a',
            border: '1px solid #444',
            borderRadius: '4px',
            color: '#fff',
            textAlign: 'center',
          }}
        />
      </div>

      {/* Seek bar */}
      <div style={{ flex: 1, padding: '0 20px' }}>
        <input
          type="range"
          min={0}
          max={300}
          step={0.1}
          value={transport.positionSeconds}
          onChange={(e) => onSeek(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {/* Host indicator (for debugging) */}
      {transport.hostClientId && (
        <div style={{ fontSize: '10px', color: '#666' }}>
          Host: {transport.hostClientId.substring(0, 8)}...
        </div>
      )}
    </div>
  );
}
