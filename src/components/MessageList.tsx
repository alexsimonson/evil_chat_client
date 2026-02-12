import type { Message } from "../types";

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div style={{ padding: 12, overflow: "auto", fontFamily: "system-ui" }}>
      {messages.map((m) => (
        <div key={m.id} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            <strong style={{ opacity: 1 }}>
              {m.user.displayName ?? m.user.username}
            </strong>{" "}
            <span>{new Date(m.createdAt).toLocaleString()}</span>
          </div>
          <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
        </div>
      ))}
    </div>
  );
}
