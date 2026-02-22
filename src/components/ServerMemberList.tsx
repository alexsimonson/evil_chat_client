import type { Member } from "../types";

export function ServerMemberList({ members }: { members: Member[] }) {
  if (members.length === 0) {
    return <div style={{ fontSize: 12, color: "#666" }}>No members</div>;
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {members.map((m) => (
        <div
          key={m.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: 6,
            border: "1px solid #ddd",
            borderRadius: 4,
            background: "white",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: m.online ? "#2ecc71" : "#aaa",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 12 }}>
            {m.displayName ?? m.username}
          </span>
        </div>
      ))}
    </div>
  );
}
