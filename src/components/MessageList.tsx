import type { Message } from "../types";
import type { RefObject } from "react";

export function MessageList({
  messages,
  scrollRef,
  bottomPadding,
}: {
  messages: Message[];
  scrollRef?: RefObject<HTMLDivElement | null>;
  bottomPadding?: number;
}) {
  return (
    <div
      ref={scrollRef}
      style={{
        padding: 12,
        paddingBottom: bottomPadding ?? 12,
        overflow: "auto",
        fontFamily: "system-ui",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {messages.map((m) => (
        <div key={m.id} style={{ marginBottom: 10, minWidth: 0 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
            <strong style={{ opacity: 1 }}>
              {m.user.displayName ?? m.user.username}
            </strong>{" "}
            <span style={{ marginLeft: 8 }}>
              {new Date(m.createdAt).toLocaleString()}
            </span>
          </div>
          <div style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            wordWrap: "break-word",
            overflowWrap: "break-word",
          }}>
            {m.content}
          </div>
        </div>
      ))}

      <style>{`
        @media (max-width: 480px) {
          div {
            padding: 8px;
          }
          div > div {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
}
