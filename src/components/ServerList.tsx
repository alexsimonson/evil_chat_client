import type { Server } from "../types";

export function ServerList({
  servers,
  activeServerId,
  onSelect,
}: {
  servers: Server[];
  activeServerId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {servers.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          style={{
            textAlign: "left",
            padding: 10,
            border: "1px solid #ccc",
            background: s.id === activeServerId ? "#eee" : "white",
            minHeight: "36px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={s.name}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}
