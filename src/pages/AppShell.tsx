import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth/AuthProvider";
import type { Server, Channel, Message, Member } from "../types";
import type { VoiceChannelInfo } from "../voice/useVoiceParticipants";
import { ServerList } from "../components/ServerList";
import { ChannelList } from "../components/ChannelList";
import { VoiceChannelList } from "../components/VoiceChannelList";
import { ServerMemberList } from "../components/ServerMemberList";
import { MessageList } from "../components/MessageList";
import { MessageComposer } from "../components/MessageComposer";
import { VoiceParticipants } from "../components/VoiceParticipants";
import { useVoice } from "../voice/useVoice";
import { useSocket } from "../websocket/useSocket";

export function AppShell() {
  const { state, logout } = useAuth();
  const user = state.status === "authed" ? state.user : null;

  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [voiceChannels, setVoiceChannels] = useState<VoiceChannelInfo[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const onlineUserIdsRef = useRef<Set<string>>(new Set());

  const voice = useVoice();

  const [activeServerId, setActiveServerId] = useState<number | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);

  const socket = useSocket(user, activeServerId);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? null,
    [channels, activeChannelId]
  );

  useEffect(() => {
    onlineUserIdsRef.current = onlineUserIds;
  }, [onlineUserIds]);

  // Load servers on mount
  useEffect(() => {
    (async () => {
      const { servers } = await api.listServers();
      setServers(servers);
      const first = servers[0]?.id ?? null;
      setActiveServerId(first);
    })().catch(console.error);
  }, []);

  // Load channels for active server
  useEffect(() => {
    if (!activeServerId) return;
    (async () => {
      const { channels } = await api.listChannels(activeServerId);
      setChannels(channels);
      const firstText = channels.find((c) => c.type === "text")?.id ?? channels[0]?.id ?? null;
      setActiveChannelId(firstText);

      // Extract voice channels for display
      const voiceChans = channels.filter((c) => c.type === "voice");
      setVoiceChannels(
        voiceChans.map((c) => ({
          id: c.id,
          name: c.name,
          livekitRoomName: c.livekitRoomName,
          participants: [],
        }))
      );

      try {
        const { channels: voiceStatus } = await api.getVoiceParticipants(activeServerId);
        setVoiceChannels(voiceStatus as VoiceChannelInfo[]);
      } catch (e) {
        console.error("Failed to load voice participants:", e);
      }

      const { members } = await api.listServerMembers(activeServerId);
      const apiOnline = new Set(members.filter((m) => m.online).map((m) => m.id));
      const currentOnline = onlineUserIdsRef.current;
      const mergedOnline = apiOnline.size > 0 ? apiOnline : currentOnline;
      setOnlineUserIds(mergedOnline);
      setMembers(members.map((m) => ({ ...m, online: mergedOnline.has(m.id) })));
    })().catch(console.error);
  }, [activeServerId]);

  // Load initial messages
  async function loadMessages(channelId: number) {
    const { messages } = await api.listMessages(channelId, 50);
    // API returns newest-first (desc). Reverse for display.
    setMessages(messages.slice().reverse());
  }

  useEffect(() => {
    if (!activeChannelId) return;
    loadMessages(activeChannelId).catch(console.error);
  }, [activeChannelId]);

  // WebSocket: Listen for new messages
  useEffect(() => {
    const unsubscribe = socket.onMessage((msg) => {
      // Only add to current channel
      if (msg.channelId === activeChannelId) {
        setMessages((prev) => [...prev, msg as any]);
      }
    });

    return unsubscribe;
  }, [socket, activeChannelId]);

  // WebSocket: Listen for user online/offline status
  useEffect(() => {
    const unsubPresenceSync = socket.onPresenceSync((data) => {
      const next = new Set(data.onlineUserIds.map((id) => String(id)));
      setOnlineUserIds(next);
      setMembers((prev) =>
        prev.map((m) => ({ ...m, online: next.has(m.id) }))
      );
    });

    const unsubOnline = socket.onUserOnline((user) => {
      setOnlineUserIds((prev) => new Set([...prev, String(user.userId)]));
      setMembers((prev) =>
        prev.map((m) => (m.id === String(user.userId) ? { ...m, online: true } : m))
      );
    });

    const unsubOffline = socket.onUserOffline((userId) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(String(userId));
        return next;
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === String(userId) ? { ...m, online: false } : m))
      );
    });

    return () => {
      unsubPresenceSync();
      unsubOnline();
      unsubOffline();
    };
  }, [socket]);

  useEffect(() => {
    if (socket.state.status === "connected") return;
    setOnlineUserIds(new Set());
    setMembers((prev) => prev.map((m) => ({ ...m, online: false })));
  }, [socket.state.status]);

  // WebSocket: Listen for voice participants updates
  useEffect(() => {
    const unsubscribe = socket.onVoiceParticipants((data) => {
      setVoiceChannels((prev) =>
        prev.map((ch) =>
          ch.id === data.channelId ? { ...ch, participants: data.participants as any } : ch
        )
      );
    });

    return unsubscribe;
  }, [socket]);

  async function onSend(content: string) {
    if (!activeChannelId || socket.state.status !== "connected") return;

    try {
      await socket.sendMessage(activeChannelId, content);
      // Message will arrive via WebSocket event
    } catch (e) {
      console.error("Failed to send message:", e);
    }
  }

  async function onJoinVoice(channelId: number) {
    try {
      if (voice.state.status === "connected") {
        await socket.leaveVoiceChannel(voice.state.channelId);
        voice.leave();
      }

      await voice.join(channelId);
      if (socket.state.status === "connected") {
        await socket.joinVoiceChannel(channelId);
      }
    } catch (e) {
      console.error("Failed to join voice:", e);
    }
  }

  async function onLeaveVoice() {
    try {
      if (voice.state.status === "connected") {
        if (socket.state.status === "connected") {
          await socket.leaveVoiceChannel(voice.state.channelId);
        }
      }
    } catch (e) {
      console.error("Failed to leave voice:", e);
    } finally {
      voice.leave();
    }
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

        <h3 style={{ marginTop: 16 }}>Members</h3>
        <ServerMemberList members={members} />

        {socket.state.status !== "connected" && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#f90", fontWeight: 600 }}>
            {socket.state.status === "connecting" ? "Connecting..." : "Disconnected"}
          </div>
        )}
      </div>

      <div style={{ borderRight: "1px solid #ddd", padding: 12 }}>
        <h3>Channels</h3>
        <ChannelList
          channels={channels}
          activeChannelId={activeChannelId}
          onSelect={setActiveChannelId}
        />

        <h3 style={{ marginTop: 24 }}>Voice Channels</h3>
        <VoiceChannelList
          channels={voiceChannels}
          activeChannelId={activeChannelId}
          onSelect={setActiveChannelId}
        />
      </div>

      {activeChannel?.type === "text" ? (
        <div style={{ display: "grid", gridTemplateRows: "1fr auto" }}>
          <MessageList messages={messages} />
          <MessageComposer onSend={onSend} />
        </div>
      ) : (
        <VoiceParticipants
          activeChannel={activeChannel}
          voice={voice}
          onJoinVoice={onJoinVoice}
          onLeaveVoice={onLeaveVoice}
        />
      )}
    </div>
  );
}
