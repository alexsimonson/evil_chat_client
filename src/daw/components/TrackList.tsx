/**
 * Track list component - shows all tracks with controls
 */

import React from 'react';
import type { Track } from '../types';

interface TrackListProps {
  tracks: Track[];
  selectedTrackId: string | null;
  armedTrackIds: Set<string>;
  mutedTrackIds: Set<string>;
  soloedTrackIds: Set<string>;
  onSelectTrack: (trackId: string) => void;
  onAddTrack: (type: 'audio' | 'midi') => void;
  onRemoveTrack: (trackId: string) => void;
  onRenameTrack: (trackId: string, name: string) => void;
  onSetVolume: (trackId: string, volume: number) => void;
  onSetMute: (trackId: string, mute: boolean) => void;
  onSetSolo: (trackId: string, solo: boolean) => void;
  onSetArm: (trackId: string, armed: boolean) => void;
}

export function TrackList({
  tracks,
  selectedTrackId,
  armedTrackIds,
  mutedTrackIds,
  soloedTrackIds,
  onSelectTrack,
  onAddTrack,
  onRemoveTrack,
  onRenameTrack,
  onSetVolume,
  onSetMute,
  onSetSolo,
  onSetArm,
}: TrackListProps) {
  const [editingTrackId, setEditingTrackId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState('');

  const handleStartEdit = (track: Track) => {
    setEditingTrackId(track.id);
    setEditingName(track.name);
  };

  const handleFinishEdit = (trackId: string) => {
    if (editingName.trim()) {
      onRenameTrack(trackId, editingName.trim());
    }
    setEditingTrackId(null);
  };

  return (
    <div
      style={{
        width: '250px',
        background: '#252525',
        borderRight: '1px solid #444',
        display: 'flex',
        flexDirection: 'column',
        color: '#fff',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px',
          background: '#2a2a2a',
          borderBottom: '1px solid #444',
          display: 'flex',
          gap: '5px',
        }}
      >
        <button
          onClick={() => onAddTrack('audio')}
          style={{
            flex: 1,
            padding: '6px',
            background: '#4a9eff',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          + Audio
        </button>
        <button
          onClick={() => onAddTrack('midi')}
          style={{
            flex: 1,
            padding: '6px',
            background: '#9e4aff',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          + MIDI
        </button>
      </div>

      {/* Track list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tracks.map((track) => (
          <div
            key={track.id}
            onClick={() => onSelectTrack(track.id)}
            style={{
              padding: '10px',
              borderBottom: '1px solid #333',
              background: track.id === selectedTrackId ? '#3a3a3a' : 'transparent',
              cursor: 'pointer',
            }}
          >
            {/* Track name */}
            <div style={{ marginBottom: '8px' }}>
              {editingTrackId === track.id ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleFinishEdit(track.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishEdit(track.id);
                    if (e.key === 'Escape') setEditingTrackId(null);
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '4px',
                    background: '#1a1a1a',
                    border: '1px solid #4a9eff',
                    borderRadius: '3px',
                    color: '#fff',
                    fontSize: '14px',
                  }}
                />
              ) : (
                <div
                  onDoubleClick={() => handleStartEdit(track)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    {track.type === 'audio' ? '🎵' : '🎹'} {track.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTrack(track.id);
                    }}
                    style={{
                      padding: '2px 6px',
                      background: '#ff4a4a',
                      border: 'none',
                      borderRadius: '3px',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '10px',
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSetArm(track.id, !armedTrackIds.has(track.id));
                }}
                style={{
                  padding: '4px 8px',
                  background: armedTrackIds.has(track.id) ? '#ff4a4a' : '#555',
                  border: 'none',
                  borderRadius: '3px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: armedTrackIds.has(track.id) ? 'bold' : 'normal',
                }}
                title="Arm track for recording"
              >
                ●
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSetMute(track.id, !mutedTrackIds.has(track.id));
                }}
                style={{
                  padding: '4px 8px',
                  background: mutedTrackIds.has(track.id) ? '#ff9e4a' : '#555',
                  border: 'none',
                  borderRadius: '3px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                M
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSetSolo(track.id, !soloedTrackIds.has(track.id));
                }}
                style={{
                  padding: '4px 8px',
                  background: soloedTrackIds.has(track.id) ? '#4aff9e' : '#555',
                  border: 'none',
                  borderRadius: '3px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                S
              </button>
            </div>

            {/* Volume slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '10px', color: '#aaa', width: '30px' }}>Vol:</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={track.volume}
                onChange={(e) => {
                  e.stopPropagation();
                  onSetVolume(track.id, Number(e.target.value));
                }}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: '10px', color: '#aaa', width: '30px' }}>
                {Math.round(track.volume * 100)}%
              </span>
            </div>
          </div>
        ))}

        {tracks.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
            No tracks. Click + Audio or + MIDI to add a track.
          </div>
        )}
      </div>
    </div>
  );
}
