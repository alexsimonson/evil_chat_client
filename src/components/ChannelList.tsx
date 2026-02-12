import type { Channel } from "../types";

export function ChannelList({
  channels,
  activeChannelId,
  onSelect,
}: {
  channels: Channel[];
  activeChannelId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {channels.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          style={{
            textAlign: "left",
            padding: 8,
            border: "1px solid #ccc",
            background: c.id === activeChannelId ? "#eee" : "white",
          }}
        >
          {c.type === "text" ? "# " : "🔊 "}
          {c.name}
        </button>
      ))}
    </div>
  );
}
