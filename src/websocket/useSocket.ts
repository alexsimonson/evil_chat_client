import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { User } from "../types";

interface SocketMessage {
  id: number;
  channelId: number;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
  };
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface SocketDirectMessage {
  id: number;
  conversationId: number;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
  };
}

interface VoiceParticipant {
  id: string;
  username: string;
  displayName: string | null;
}

interface OnlineUser {
  userId: string;
  username: string;
  displayName: string | null;
}

interface PresenceSync {
  onlineUserIds: string[];
}

type SocketState =
  | { status: "disconnected" }
  | { status: "connecting" }
  | { status: "connected"; serverId: number };

export function useSocket(user: User | null, serverId: number | null) {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<SocketState>({ status: "disconnected" });

  // Handlers for different events (refs avoid re-render loops)
  const messageHandlersRef = useRef<Array<(msg: SocketMessage) => void>>([]);
  const userOnlineHandlersRef = useRef<Array<(user: OnlineUser) => void>>([]);
  const userOfflineHandlersRef = useRef<Array<(userId: string) => void>>([]);
  const presenceSyncHandlersRef = useRef<Array<(data: PresenceSync) => void>>([]);
  const voiceParticipantsHandlersRef = useRef<
    Array<(data: { channelId: number; participants: VoiceParticipant[] }) => void>
  >([]);
  const dmHandlersRef = useRef<Array<(msg: SocketDirectMessage) => void>>([]);

  // Connection logic
  useEffect(() => {
    if (!user || !serverId) {
      // Disconnect if no user or server
      if (socketRef.current?.connected) {
        socketRef.current.disconnect();
      }
      setState({ status: "disconnected" });
      return;
    }

    setState({ status: "connecting" });

    const socket = io(import.meta.env.VITE_API_URL as string, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] Connected, authenticating...");

      // Authenticate with server
      socket.emit(
        "auth",
        { userId: user.id, serverId },
        (response: any) => {
          console.log("[Socket] Auth response:", response);
          if (response?.error) {
            console.error("[Socket] Auth failed:", response.error);
            setState({ status: "disconnected" });
            socket.disconnect();
          } else if (response?.success) {
            console.log("[Socket] Authenticated successfully");
            setState({ status: "connected", serverId });
          } else {
            console.warn("[Socket] Unexpected auth response:", response);
          }
        }
      );
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      setState({ status: "disconnected" });
    });

    socket.on("connect_error", (error: any) => {
      console.error("[Socket] Connection error:", error);
      setState({ status: "disconnected" });
    });

    socket.on("error", (error: any) => {
      console.error("[Socket] Socket error:", error);
    });

    socket.on("presence:sync", (data: PresenceSync) => {
      console.log("[Socket] Presence sync:", data);
      presenceSyncHandlersRef.current.forEach((handler) => handler(data));
    });

    // Listen for new messages
    socket.on("message:new", (raw: any) => {
      const msg: SocketMessage = {
        id: toNumber(raw?.id),
        channelId: toNumber(raw?.channelId),
        content: String(raw?.content ?? ""),
        createdAt: String(raw?.createdAt ?? new Date().toISOString()),
        user: {
          id: String(raw?.user?.id ?? ""),
          username: String(raw?.user?.username ?? "unknown-user"),
          displayName: raw?.user?.displayName ?? null,
        },
      };

      console.log("[Socket] New message:", msg);
      messageHandlersRef.current.forEach((handler) => handler(msg));
    });

    // Listen for user online
    socket.on("user:online", (user: OnlineUser) => {
      console.log("[Socket] User online:", user);
      userOnlineHandlersRef.current.forEach((handler) => handler(user));
    });

    // Listen for user offline
    socket.on("user:offline", (data: { userId: string }) => {
      console.log("[Socket] User offline:", data.userId);
      userOfflineHandlersRef.current.forEach((handler) => handler(data.userId));
    });

    // Listen for voice participants update
    socket.on(
      "voice:participants",
      (data: { channelId: number; participants: VoiceParticipant[] }) => {
        console.log("[Socket] Voice participants update:", data);
        voiceParticipantsHandlersRef.current.forEach((handler) => handler(data));
      }
    );

    socket.on("dm:new", (raw: any) => {
      const msg: SocketDirectMessage = {
        id: toNumber(raw?.id),
        conversationId: toNumber(raw?.conversationId),
        content: String(raw?.content ?? ""),
        createdAt: String(raw?.createdAt ?? new Date().toISOString()),
        user: {
          id: String(raw?.user?.id ?? ""),
          username: String(raw?.user?.username ?? "unknown-user"),
          displayName: raw?.user?.displayName ?? null,
        },
      };

      console.log("[Socket] New direct message:", msg);
      dmHandlersRef.current.forEach((handler) => handler(msg));
    });

    return () => {
      if (socket.connected) {
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [user, serverId]);

  const sendMessage = useCallback(
    async (channelId: number, content: string): Promise<number> => {
      if (!socketRef.current?.connected) {
        throw new Error("Socket not connected");
      }

      return new Promise((resolve, reject) => {
        socketRef.current!.emit(
          "message:send",
          { channelId, content },
          (response: any) => {
            if (response?.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.messageId);
            }
          }
        );
      });
    },
    []
  );

  const joinVoiceChannel = useCallback(
    async (channelId: number): Promise<number> => {
      if (!socketRef.current?.connected) {
        throw new Error("Socket not connected");
      }

      return new Promise((resolve, reject) => {
        socketRef.current!.emit(
          "voice:join",
          { channelId },
          (response: any) => {
            if (response?.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.sessionId);
            }
          }
        );
      });
    },
    []
  );

  const leaveVoiceChannel = useCallback(
    async (channelId: number): Promise<void> => {
      if (!socketRef.current?.connected) {
        throw new Error("Socket not connected");
      }

      return new Promise((resolve, reject) => {
        socketRef.current!.emit(
          "voice:leave",
          { channelId },
          (response: any) => {
            if (response?.error) {
              reject(new Error(response.error));
            } else {
              resolve();
            }
          }
        );
      });
    },
    []
  );

  const onMessage = useCallback((handler: (msg: SocketMessage) => void) => {
    messageHandlersRef.current = [...messageHandlersRef.current, handler];
    return () => {
      messageHandlersRef.current = messageHandlersRef.current.filter((h) => h !== handler);
    };
  }, []);

  const onUserOnline = useCallback((handler: (user: OnlineUser) => void) => {
    userOnlineHandlersRef.current = [...userOnlineHandlersRef.current, handler];
    return () => {
      userOnlineHandlersRef.current = userOnlineHandlersRef.current.filter(
        (h) => h !== handler
      );
    };
  }, []);

  const onUserOffline = useCallback((handler: (userId: string) => void) => {
    userOfflineHandlersRef.current = [...userOfflineHandlersRef.current, handler];
    return () => {
      userOfflineHandlersRef.current = userOfflineHandlersRef.current.filter(
        (h) => h !== handler
      );
    };
  }, []);

  const onPresenceSync = useCallback((handler: (data: PresenceSync) => void) => {
    presenceSyncHandlersRef.current = [...presenceSyncHandlersRef.current, handler];
    return () => {
      presenceSyncHandlersRef.current = presenceSyncHandlersRef.current.filter(
        (h) => h !== handler
      );
    };
  }, []);

  const onVoiceParticipants = useCallback(
    (handler: (data: { channelId: number; participants: VoiceParticipant[] }) => void) => {
      voiceParticipantsHandlersRef.current = [
        ...voiceParticipantsHandlersRef.current,
        handler,
      ];
      return () => {
        voiceParticipantsHandlersRef.current = voiceParticipantsHandlersRef.current.filter(
          (h) => h !== handler
        );
      };
    },
    []
  );

  const sendDirectMessage = useCallback(
    async (conversationId: number, content: string): Promise<number> => {
      if (!socketRef.current?.connected) {
        throw new Error("Socket not connected");
      }

      return new Promise((resolve, reject) => {
        socketRef.current!.emit(
          "dm:send",
          { conversationId, content },
          (response: any) => {
            if (response?.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.messageId);
            }
          }
        );
      });
    },
    []
  );

  const onDirectMessage = useCallback((handler: (msg: SocketDirectMessage) => void) => {
    dmHandlersRef.current = [...dmHandlersRef.current, handler];
    return () => {
      dmHandlersRef.current = dmHandlersRef.current.filter((h) => h !== handler);
    };
  }, []);

  return {
    state,
    sendMessage,
    sendDirectMessage,
    joinVoiceChannel,
    leaveVoiceChannel,
    onMessage,
    onDirectMessage,
    onUserOnline,
    onUserOffline,
    onPresenceSync,
    onVoiceParticipants,
  };
}
