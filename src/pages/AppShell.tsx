import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth/AuthProvider";
import type { Server, Channel, Message, Member } from "../types";
import type { VoiceChannelInfo } from "../voice/useVoiceParticipants";
import { ServerList } from "../components/ServerList";
import { ChannelList } from "../components/ChannelList";
import { ChannelCreateDialog } from "../components/ChannelCreateDialog";
import { VoiceChannelList } from "../components/VoiceChannelList";
import { ServerMemberList } from "../components/ServerMemberList";
import { MessageList } from "../components/MessageList";
import { MessageComposer } from "../components/MessageComposer";
import { VoiceParticipants } from "../components/VoiceParticipants";
import { useVoice } from "../voice/useVoice";
import { useSocket } from "../websocket/useSocket";
import { SimpleDawView } from "./SimpleDawView";

type TabType = "servers" | "text" | "voice";

export function AppShell() {
  // DAW view toggle
  const [showDaw, setShowDaw] = useState(false);

  // Call all hooks before any conditional returns
  const { state, logout } = useAuth();
  const user = state.status === "authed" ? state.user : null;

  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [voiceChannels, setVoiceChannels] = useState<VoiceChannelInfo[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const onlineUserIdsRef = useRef<Set<string>>(new Set());
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const voice = useVoice();

  const [activeServerId, setActiveServerId] = useState<number | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("text");
  const [showCreateChannelDialog, setShowCreateChannelDialog] = useState(false);
  const [createChannelType, setCreateChannelType] = useState<"text" | "voice">("text");
  const [showTextChannelList, setShowTextChannelList] = useState(true);
  const [showVoiceChannelList, setShowVoiceChannelList] = useState(true);

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
      // Don't auto-select a channel; let user select from main screen
      setActiveChannelId(null);
      setShowTextChannelList(true);
      setShowVoiceChannelList(true);

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

  function scrollToLatest() {
    const el = messageListRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
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

  async function onCreateChannel(name: string, type: "text" | "voice") {
    if (!activeServerId) return;
    try {
      const { channel } = await api.createChannel(activeServerId, name, type);
      // Refresh channels list
      const { channels: updated } = await api.listChannels(activeServerId);
      setChannels(updated);
      // Auto-select the new channel and show it
      setActiveChannelId(channel.id);
      if (type === "text") {
        setActiveTab("text");
        setShowTextChannelList(false);
      } else {
        setActiveTab("voice");
        setShowVoiceChannelList(false);
      }
    } catch (e) {
      console.error("Failed to create channel:", e);
      throw e;
    }
  }

  // If in DAW mode, show DAW instead of chat
  if (showDaw) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 20px', background: '#2a2a2a', borderBottom: '1px solid #444', color: '#fff', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={() => setShowDaw(false)} style={{ padding: '8px 16px', background: '#555', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>
            ← Back to Chat
          </button>
          <h2 style={{ margin: 0, fontSize: '18px' }}>🎵 Collaborative DAW</h2>
        </div>
        <SimpleDawView />
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      width: "100%",
      overflow: "hidden",
    }} className="app-shell-container">
      {/* Content Area */}
      <div className="app-shell-content" style={{
        flex: 1,
        overflow: "hidden",
        display: "flex",
        width: "100%",
      }}>
        {/* Desktop Layout */}
        <div className="app-shell-desktop" style={{
          display: "grid",
          gridTemplateColumns: "220px 260px 1fr",
          height: "100vh",
          gap: "1px",
          overflow: "hidden",
        }}>
          {/* Sidebar - Servers & Members */}
          <div style={{
            borderRight: "1px solid #ddd",
            padding: "12px",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
              marginBottom: "12px",
              flexWrap: "wrap",
            }}>
              <strong style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {state.status === "authed" ? state.user.username : "..."}
              </strong>
              <div style={{ display: "flex", gap: "4px" }}>
                <button onClick={() => setShowDaw(true)} style={{ whiteSpace: "nowrap", padding: "6px 12px", fontSize: "0.85rem", background: "#4a9eff", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                  🎵 DAW
                </button>
                <button onClick={() => logout().catch(console.error)} style={{ whiteSpace: "nowrap", padding: "6px 12px", fontSize: "0.85rem" }}>
                  Logout
                </button>
              </div>
            </div>

            <h3 style={{ marginTop: "16px", marginBottom: "8px", fontSize: "0.95rem" }}>Servers</h3>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginBottom: "12px" }}>
              <ServerList
                servers={servers}
                activeServerId={activeServerId}
                onSelect={setActiveServerId}
              />
            </div>

            <h3 style={{ marginTop: "16px", marginBottom: "8px", fontSize: "0.95rem" }}>Members</h3>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              <ServerMemberList members={members} />
            </div>

            {socket.state.status !== "connected" && (
              <div style={{ marginTop: 12, fontSize: 12, color: "#f90", fontWeight: 600, padding: "8px", backgroundColor: "rgba(255, 153, 0, 0.1)", borderRadius: "4px" }}>
                {socket.state.status === "connecting" ? "Connecting..." : "Disconnected"}
              </div>
            )}
          </div>

          {/* Center Sidebar - Channels */}
          <div style={{
            borderRight: "1px solid #ddd",
            padding: "12px",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ marginTop: 0, marginBottom: 0, fontSize: "0.95rem" }}>Channels</h3>
              <button
                onClick={() => {
                  setCreateChannelType("text");
                  setShowCreateChannelDialog(true);
                }}
                style={{
                  padding: "4px 8px",
                  fontSize: "0.85rem",
                  minHeight: "28px",
                  minWidth: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Create text channel"
              >
                +
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginBottom: "12px" }}>
              <ChannelList
                channels={channels.filter((c) => c.type === "text")}
                activeChannelId={activeChannelId}
                onSelect={setActiveChannelId}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ marginTop: "16px", marginBottom: 0, fontSize: "0.95rem" }}>Voice</h3>
              <button
                onClick={() => {
                  setCreateChannelType("voice");
                  setShowCreateChannelDialog(true);
                }}
                style={{
                  padding: "4px 8px",
                  fontSize: "0.85rem",
                  minHeight: "28px",
                  minWidth: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Create voice channel"
              >
                +
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              <VoiceChannelList
                channels={voiceChannels}
                activeChannelId={activeChannelId}
                onSelect={setActiveChannelId}
              />
            </div>
          </div>

          {/* Main Content Area */}
          <div style={{ display: "grid", gridTemplateRows: "1fr auto", minWidth: 0, overflow: "hidden" }}>
            {activeChannel?.type === "text" ? (
              <>
                <MessageList messages={messages} />
                <MessageComposer onSend={onSend} />
              </>
            ) : (
              <VoiceParticipants
                activeChannel={activeChannel}
                voice={voice}
                onJoinVoice={onJoinVoice}
                onLeaveVoice={onLeaveVoice}
              />
            )}
          </div>
        </div>

        {/* Mobile Layout - Tabs */}
        <div className="app-shell-mobile">
          {/* Servers Tab */}
          {activeTab === "servers" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, width: "100%" }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px",
                borderBottom: "1px solid #ddd",
                gap: "8px",
                flexShrink: 0,
              }}>
                <strong>
                  {state.status === "authed" ? state.user.username : "..."}
                </strong>
                <button onClick={() => logout().catch(console.error)} style={{ padding: "6px 12px", fontSize: "0.85rem" }}>
                  Logout
                </button>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: "12px", minHeight: 0 }}>
                <h3 style={{ marginTop: 0 }}>Servers</h3>
                <ServerList
                  servers={servers}
                  activeServerId={activeServerId}
                  onSelect={setActiveServerId}
                />
                
                <h3 style={{ marginTop: "24px" }}>Projects</h3>
                <button
                  onClick={() => setShowDaw(true)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "linear-gradient(135deg, #9e4aff 0%, #4a9eff 100%)",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 2px 8px rgba(158, 74, 255, 0.3)",
                  }}
                >
                  <span style={{ fontSize: "18px" }}>🎵</span>
                  Collaborative DAW
                </button>
                
                <h3 style={{ marginTop: "24px" }}>Members</h3>
                <ServerMemberList members={members} />
              </div>
            </div>
          )}

          {/* Text Tab - Text Channels + Messages */}
          {activeTab === "text" && (
            <div style={{ display: "grid", gridTemplateRows: showTextChannelList ? "1fr" : "auto 1fr", height: "100%", minHeight: 0, width: "100%" }}>
              {!showTextChannelList && activeChannel?.type === "text" && (
                <div style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid #ddd",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  flexShrink: 0,
                }}>
                  <button
                    onClick={() => setShowTextChannelList(true)}
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      flexShrink: 0,
                    }}
                    title="Back to channel list"
                  >
                    ←
                  </button>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                    # {activeChannel.name}
                  </div>
                </div>
              )}
              {!showTextChannelList && activeChannel?.type === "text" ? (
                <>
                  <MessageList
                    messages={messages}
                    scrollRef={messageListRef}
                    bottomPadding={128}
                  />
                  <div className="mobile-message-composer">
                    <MessageComposer onSend={onSend} />
                  </div>
                  <button
                    onClick={scrollToLatest}
                    style={{
                      position: "fixed",
                      right: 12,
                      bottom: 124,
                      zIndex: 1002,
                      padding: "8px 10px",
                      borderRadius: "999px",
                      border: "1px solid #ddd",
                      background: "white",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
                      fontSize: "0.95rem",
                    }}
                    title="Jump to latest"
                  >
                    ↓
                  </button>
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.6, gap: "16px", padding: "20px" }}>
                  <div>Select a text channel to start chatting</div>
                  <button
                    onClick={() => {
                      setCreateChannelType("text");
                      setShowCreateChannelDialog(true);
                    }}
                    style={{ marginTop: "8px" }}
                  >
                    + Create Channel
                  </button>
                  <div style={{ fontSize: "0.85rem", maxHeight: "calc(100% - 120px)", overflow: "auto", width: "100%", paddingTop: "12px", borderTop: "1px solid #ddd" }}>
                    <h4 style={{ marginTop: 0 }}>Text Channels</h4>
                    {channels.filter((c) => c.type === "text").length === 0 ? (
                      <div style={{ opacity: 0.6, fontSize: "0.85rem" }}>No channels yet</div>
                    ) : (
                      <ChannelList
                        channels={channels.filter((c) => c.type === "text")}
                        activeChannelId={activeChannelId}
                        onSelect={(id) => {
                          setActiveChannelId(id);
                          setShowTextChannelList(false);
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Voice Tab - Voice Channels + Participants */}
          {activeTab === "voice" && (
            <div style={{ display: "grid", gridTemplateRows: showVoiceChannelList ? "1fr" : "auto 1fr", height: "100%", minHeight: 0, width: "100%" }}>
              {!showVoiceChannelList && activeChannel?.type === "voice" && (
                <div style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid #ddd",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  flexShrink: 0,
                }}>
                  <button
                    onClick={() => setShowVoiceChannelList(true)}
                    style={{
                      padding: "4px 8px",
                      fontSize: "0.85rem",
                      flexShrink: 0,
                    }}
                    title="Back to channel list"
                  >
                    ←
                  </button>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                    🔊 {activeChannel.name}
                  </div>
                </div>
              )}
              {!showVoiceChannelList && activeChannel?.type === "voice" ? (
                <VoiceParticipants
                  activeChannel={activeChannel}
                  voice={voice}
                  onJoinVoice={onJoinVoice}
                  onLeaveVoice={onLeaveVoice}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.6, gap: "16px", padding: "20px" }}>
                  <div>Select a voice channel to join</div>
                  <button
                    onClick={() => {
                      setCreateChannelType("voice");
                      setShowCreateChannelDialog(true);
                    }}
                    style={{ marginTop: "8px" }}
                  >
                    + Create Channel
                  </button>
                  <div style={{ fontSize: "0.85rem", maxHeight: "calc(100% - 120px)", overflow: "auto", width: "100%", paddingTop: "12px", borderTop: "1px solid #ddd" }}>
                    <h4 style={{ marginTop: 0 }}>Voice Channels</h4>
                    {voiceChannels.length === 0 ? (
                      <div style={{ opacity: 0.6, fontSize: "0.85rem" }}>No voice channels yet</div>
                    ) : (
                      <VoiceChannelList
                        channels={voiceChannels}
                        activeChannelId={activeChannelId}
                        onSelect={(id) => {
                          setActiveChannelId(id);
                          setShowVoiceChannelList(false);
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation Bar - Mobile Only */}
      <div className="app-shell-nav" style={{
        display: "none",
        gridTemplateColumns: "repeat(3, 1fr)",
        borderTop: "1px solid #ddd",
        backgroundColor: "white",
        gap: 0,
        width: "100%",
        flexShrink: 0,
        zIndex: 100,
      }}>
        <button
          onClick={() => setActiveTab("servers")}
          className={activeTab === "servers" ? "tab-active" : ""}
          style={{
            flex: 1,
            padding: "12px",
            border: "none",
            background: activeTab === "servers" ? "#646cff" : "transparent",
            color: activeTab === "servers" ? "white" : "inherit",
            borderTop: activeTab === "servers" ? "3px solid #646cff" : "1px solid #ddd",
            cursor: "pointer",
            fontSize: "0.85rem",
            minHeight: "52px",
            borderRadius: 0,
          }}
        >
          🏢 Servers
        </button>
        <button
          onClick={() => setActiveTab("text")}
          className={activeTab === "text" ? "tab-active" : ""}
          style={{
            flex: 1,
            padding: "12px",
            border: "none",
            background: activeTab === "text" ? "#646cff" : "transparent",
            color: activeTab === "text" ? "white" : "inherit",
            borderTop: activeTab === "text" ? "3px solid #646cff" : "1px solid #ddd",
            cursor: "pointer",
            fontSize: "0.85rem",
            minHeight: "52px",
            borderRadius: 0,
          }}
        >
          💬 Chat
        </button>
        <button
          onClick={() => setActiveTab("voice")}
          className={activeTab === "voice" ? "tab-active" : ""}
          style={{
            flex: 1,
            padding: "12px",
            border: "none",
            background: activeTab === "voice" ? "#646cff" : "transparent",
            color: activeTab === "voice" ? "white" : "inherit",
            borderTop: activeTab === "voice" ? "3px solid #646cff" : "1px solid #ddd",
            cursor: "pointer",
            fontSize: "0.85rem",
            minHeight: "52px",
            borderRadius: 0,
          }}
        >
          🎤 Voice
        </button>
      </div>

      <ChannelCreateDialog
        isOpen={showCreateChannelDialog}
        onClose={() => setShowCreateChannelDialog(false)}
        onCreateChannel={onCreateChannel}
        defaultType={createChannelType}
      />

      <style>{`
        .app-shell-container {
          width: 100%;
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }

        .app-shell-content {
          flex: 1;
          overflow: hidden;
          width: 100%;
          display: flex;
          padding-bottom: 0;
        }

        .app-shell-desktop {
          display: grid !important;
          width: 100%;
          height: 100%;
        }

        .app-shell-mobile {
          display: none;
          flex-direction: column;
          width: 100%;
          height: 100%;
          flex: 1;
          overflow: hidden;
          padding-bottom: 52px;
        }

        .app-shell-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display: none;
          grid-template-columns: repeat(3, 1fr) !important;
          border-top: 1px solid #ddd;
          background: white;
          gap: 0 !important;
          width: 100% !important;
          height: 52px;
          flex-shrink: 0;
          z-index: 1000;
          box-sizing: border-box;
        }

        .app-shell-nav button {
          border-radius: 0 !important;
          min-height: 52px !important;
          padding: 12px !important;
          height: 52px;
          border: none;
        }

        .mobile-message-composer {
          display: none;
        }

        @media (prefers-color-scheme: light) {
          .app-shell-nav {
            background: white;
          }
        }

        @media (max-width: 1024px) {
          .app-shell-container {
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
          }

          .app-shell-content {
            flex: 1;
            overflow: hidden;
            width: 100%;
            display: flex;
            padding-bottom: 52px;
          }

          .mobile-message-composer {
            display: block;
            position: fixed;
            left: 0;
            right: 0;
            bottom: 52px;
            z-index: 1001;
            background: white;
            box-sizing: border-box;
          }

          .app-shell-desktop {
            display: none !important;
          }

          .app-shell-mobile {
            display: flex !important;
            flex: 1;
            overflow: hidden;
            padding-bottom: 0;
          }

          .app-shell-nav {
            display: grid !important;
          }
        }
      `}</style>
    </div>
  );
}
