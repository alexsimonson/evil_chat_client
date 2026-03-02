import type { DirectMessageConversation } from "../types";

export function DirectMessageList({
  conversations,
  activeConversationId,
  onSelect,
}: {
  conversations: DirectMessageConversation[];
  activeConversationId: number | null;
  onSelect: (conversationId: number) => void;
}) {
  if (conversations.length === 0) {
    return <div style={{ fontSize: 12, color: "#666" }}>No conversations yet</div>;
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {conversations.map((conversation) => {
        const isActive = activeConversationId === conversation.id;
        const title = conversation.otherUser.displayName ?? conversation.otherUser.username;

        return (
          <button
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            style={{
              textAlign: "left",
              border: "1px solid #ddd",
              borderRadius: 6,
              padding: "8px",
              cursor: "pointer",
              background: isActive ? "rgba(100, 108, 255, 0.08)" : "white",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 11,
                opacity: 0.7,
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {conversation.lastMessagePreview ?? "No messages yet"}
            </div>
          </button>
        );
      })}
    </div>
  );
}
