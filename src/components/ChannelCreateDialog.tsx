import { useState, useEffect } from "react";

export function ChannelCreateDialog({
  isOpen,
  onClose,
  onCreateChannel,
  defaultType = "text",
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreateChannel: (name: string, type: "text" | "voice") => Promise<void>;
  defaultType?: "text" | "voice";
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "voice">(defaultType);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setType(defaultType);
  }, [defaultType, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Channel name is required");
      return;
    }

    setBusy(true);
    try {
      await onCreateChannel(trimmed, type);
      setName("");
      setType("text");
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create channel");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "400px",
          width: "100%",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>Create Channel</h2>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          <div>
            <label style={{ marginBottom: "6px", fontWeight: 500, display: "block" }}>
              Channel Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., general, announcements"
              autoFocus
              disabled={busy}
            />
          </div>

          <div>
            <label style={{ marginBottom: "6px", fontWeight: 500, display: "block" }}>
              Channel Type
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer", background: type === "text" ? "#f0f0f0" : "white" }}>
                <input
                  type="radio"
                  value="text"
                  checked={type === "text"}
                  onChange={(e) => setType(e.target.value as "text")}
                  disabled={busy}
                  style={{ cursor: "pointer" }}
                />
                💬 Text
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer", background: type === "voice" ? "#f0f0f0" : "white" }}>
                <input
                  type="radio"
                  value="voice"
                  checked={type === "voice"}
                  onChange={(e) => setType(e.target.value as "voice")}
                  disabled={busy}
                  style={{ cursor: "pointer" }}
                />
                🎤 Voice
              </label>
            </div>
          </div>

          {error && (
            <div
              style={{
                color: "crimson",
                padding: "12px",
                backgroundColor: "rgba(220, 20, 60, 0.1)",
                borderRadius: "4px",
                fontSize: "0.9rem",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={{
                background: "#f0f0f0",
                color: "inherit",
              }}
            >
              Cancel
            </button>
            <button type="submit" disabled={busy} style={{ minHeight: "44px" }}>
              {busy ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @media (prefers-color-scheme: light) {
          div {
            color: #213547;
          }
        }
      `}</style>
    </div>
  );
}
