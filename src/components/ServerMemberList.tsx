import type { Member } from "../types";
import { DMButton } from "./DMButton";

export function ServerMemberList({ 
  members, 
  onMemberClick,
  onMessageClick,
  currentUserId,
}: { 
  members: Member[];
  onMemberClick?: (userId: string) => void;
  onMessageClick?: (userId: string) => void;
  currentUserId?: string;
}) {
  if (members.length === 0) {
    return <div style={{ fontSize: 12, color: "#666" }}>No members</div>;
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {members.map((m) => (
        <div
          key={m.id}
          onClick={() => onMemberClick?.(m.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: 6,
            border: "1px solid #ddd",
            borderRadius: 4,
            background: "white",
            minHeight: "32px",
            minWidth: 0,
            cursor: onMemberClick ? "pointer" : "default",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={(e) => {
            if (onMemberClick) {
              e.currentTarget.style.backgroundColor = "#f5f5f5";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "white";
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: m.online ? "#2ecc71" : "#aaa",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span style={{
            fontSize: 12,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
            flex: 1,
          }}
          title={m.displayName ?? m.username}>
            {m.displayName ?? m.username}
          </span>
          {onMessageClick && m.id !== currentUserId && (
            <DMButton
              onClick={(e) => {
                e.stopPropagation();
                onMessageClick(m.id);
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
