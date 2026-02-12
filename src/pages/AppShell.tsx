import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth/AuthProvider";
import type { Server, Channel, Message } from "../types";
import { ServerList } from "../components/ServerList";
import { ChannelList } from "../components/ChannelList";
import { MessageList } from "../components/MessageList";
import { MessageComposer } from "../components/MessageComposer";
import { useVoice } from "../voice/useVoice";


export function AppShell() {
  const { state, logout } = useAuth();

  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const voice = useVoice();

  const [activeServerId, setActiveServerId] = useState<number | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? null,
    [channels, activeChannelId]
  );

  useEffect(() => {
    (async () => {
      const { servers } = await api.listServers();
      setServers(servers);
      const first = servers[0]?.id ?? null;
      setActiveServerId(first);
    })().catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeServerId) return;
    (async () => {
      const { channels } = await api.listChannels(activeServerId);
      setChannels(channels);
      const firstText = channels.find((c) => c.type === "text")?.id ?? channels[0]?.id ?? null;
      setActiveChannelId(firstText);
    })().catch(console.error);
  }, [activeServerId]);

  async function loadMessages(channelId: number) {
    const { messages } = await api.listMessages(channelId, 50);
    // API returns newest-first (desc). Reverse for display.
    setMessages(messages.slice().reverse());
  }

  useEffect(() => {
    if (!activeChannelId) return;
    loadMessages(activeChannelId).catch(console.error);
  }, [activeChannelId]);

  async function onSend(content: string) {
    if (!activeChannelId) return;

    // If you haven’t implemented POST /channels/:id/messages yet, comment this out.
    await api.sendMessage(activeChannelId, content);

    // reload
    await loadMessages(activeChannelId);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 260px 1fr", height: "100vh" }}>
      <div style={{ borderRight: "1px solid #ddd", padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>{state.status === "authed" ? state.user.username : "..."}</strong>
          <button onClick={() => logout().catch(console.error)}>Logout</button>
        </div>

        <h3 style={{ marginTop: 16 }}>Servers</h3>
        <ServerList
          servers={servers}
          activeServerId={activeServerId}
          onSelect={setActiveServerId}
        />
      </div>

      <div style={{ borderRight: "1px solid #ddd", padding: 12 }}>
        <h3>Channels</h3>
        <ChannelList
          channels={channels}
          activeChannelId={activeChannelId}
          onSelect={setActiveChannelId}
        />
        {activeChannel?.type === "voice" && (
  <div style={{ marginTop: 12, padding: 10, border: "1px dashed #aaa" }}>
    <div style={{ fontWeight: 600, marginBottom: 8 }}>Voice</div>

    {voice.state.status === "idle" && (
      <button onClick={() => voice.join(activeChannel.id).catch(console.error)}>
        Join Voice
      </button>
    )}

    {voice.state.status === "connecting" && <div>Connecting…</div>}

    {voice.state.status === "connected" && (
      <div style={{ display: "grid", gap: 8 }}>
        <div>
          Room: <code>{voice.state.roomName}</code>
        </div>
        <div>Participants: {voice.state.participants}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => voice.toggleMute().catch(console.error)}>
            {voice.state.muted ? "Unmute" : "Mute"}
          </button>
          <button onClick={() => voice.leave()}>Leave</button>
        </div>
      </div>
    )}

    {voice.state.status === "error" && (
      <div style={{ color: "crimson" }}>
        Voice error: {voice.state.message}
      </div>
    )}
  </div>
)}

      </div>

      <div style={{ display: "grid", gridTemplateRows: "1fr auto" }}>
        <MessageList messages={messages} />
        {activeChannel?.type === "text" ? (
          <MessageComposer onSend={onSend} />
        ) : (
          <div style={{ padding: 12, borderTop: "1px solid #ddd", opacity: 0.7 }}>
            Select a text channel to send messages.
          </div>
        )}
      </div>
    </div>
  );
}
