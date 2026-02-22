import { useState } from "react";

export function MessageComposer({ onSend }: { onSend: (content: string) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const content = value.trim();
    if (!content) return;
    setBusy(true);
    try {
      await onSend(content);
      setValue("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      padding: 12,
      borderTop: "1px solid #ddd",
      display: "flex",
      gap: 8,
      alignItems: "flex-end",
      backgroundColor: "inherit",
      minHeight: "52px",
    }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Message..."
        style={{
          flex: 1,
          padding: 10,
          minHeight: "40px",
          resize: "none",
          fontFamily: "system-ui",
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit().catch(console.error);
          }
        }}
      />
      <button
        disabled={busy}
        onClick={() => submit().catch(console.error)}
        style={{
          padding: "10px 14px",
          whiteSpace: "nowrap",
          minHeight: "40px",
          minWidth: "40px",
        }}
      >
        Send
      </button>

      <style>{`
        @media (max-width: 480px) {
          div {
            padding: 8px;
            gap: 6px;
          }
          input {
            padding: 8px;
            font-size: 16px;
          }
          button {
            padding: 8px 12px;
            font-size: 0.9rem;
          }
        }
      `}</style>
    </div>
  );
}
