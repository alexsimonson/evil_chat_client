import type { VoiceChannelInfo } from "../voice/useVoiceParticipants";

export function VoiceChannelList({
  channels,
  activeChannelId,
  onSelect,
}: {
  channels: VoiceChannelInfo[];
  activeChannelId: number | null;
  onSelect: (id: number) => void;
}) {
  if (channels.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "#666" }}>
        No voice channels in this server
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {channels.map((channel) => (
        <div
          key={channel.id}
          style={{
            padding: 10,
            border: "1px solid #ccc",
            borderRadius: 4,
            background: channel.id === activeChannelId ? "#f0f0f0" : "white",
            cursor: "pointer",
            minHeight: "44px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minWidth: 0,
          }}
          onClick={() => onSelect(channel.id)}
        >
          <div style={{ fontWeight: 600, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            🔊 {channel.name}
          </div>
          <div style={{ fontSize: 12, color: "#666", overflow: "auto", maxHeight: "100px" }}>
            {channel.participants.length === 0 ? (
              <div>No one connected</div>
            ) : (
              <div>
                <div style={{ marginBottom: 4 }}>
                  {channel.participants.length} connected:
                </div>
                <div style={{ display: "grid", gap: 2 }}>
                  {channel.participants.map((participant) => (
                    <div
                      key={participant.id}
                      style={{
                        padding: 4,
                        background: "#f5f5f5",
                        borderRadius: 3,
                        fontSize: 11,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      • {participant.displayName || participant.username}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
