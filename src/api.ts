import type { User, Server, Channel, Message, Member } from "./types";

const API_URL = import.meta.env.VITE_API_URL as string;

type ApiError = { error: string };

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    let err: ApiError | null = null;
    try {
      err = (await res.json()) as ApiError;
    } catch {
      // ignore
    }
    const msg = err?.error ?? `HTTP_${res.status}`;
    throw new Error(msg);
  }

  // 204 no content
  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}

export const api = {
  // Auth
  me: () => apiFetch<{ user: User }>("/auth/me"),
  login: (email: string, password: string) =>
    apiFetch<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  signup: (email: string, username: string, password: string) =>
    apiFetch<{ user: User }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, username, password }),
    }),
  logout: () =>
    apiFetch<void>("/auth/logout", {
      method: "POST",
    }),
  updateProfile: (data: { username?: string; displayName?: string; email?: string }) =>
    apiFetch<{ user: User }>("/auth/me", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteAccount: () =>
    apiFetch<void>("/auth/me", {
      method: "DELETE",
    }),
  getUserProfile: (userId: string) =>
    apiFetch<{ user: User }>(`/auth/users/${userId}`),

  // Read models
  listServers: () => apiFetch<{ servers: Server[] }>("/servers"),
  listChannels: (serverId: number) =>
    apiFetch<{ channels: Channel[] }>(`/servers/${serverId}/channels`),
  listServerMembers: (serverId: number) =>
    apiFetch<{ members: Member[] }>(`/servers/${serverId}/members`),
  listMessages: (channelId: number, limit = 50, before?: number) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (before) qs.set("before", String(before));
    return apiFetch<{ messages: Message[]; nextCursor: number | null }>(
      `/channels/${channelId}/messages?${qs.toString()}`
    );
  },

  // Channel creation
  createChannel: (serverId: number, name: string, type: "text" | "voice") =>
    apiFetch<{ channel: Channel }>(`/servers/${serverId}/channels`, {
      method: "POST",
      body: JSON.stringify({ name, type }),
    }),

  // Voice participants - available to all members without being connected
  getVoiceParticipants: (serverId: number) =>
    apiFetch<{
      channels: Array<{
        id: number;
        name: string;
        livekitRoomName: string | null;
        participants: Array<{ id: string; username: string; displayName: string | null }>;
      }>;
    }>(`/channels/voice/participants/${serverId}`),

  // Voice session tracking
  startVoiceSession: (channelId: number) =>
    apiFetch<{ sessionId: number }>("/livekit/session/start", {
      method: "POST",
      body: JSON.stringify({ channelId }),
    }),
  endVoiceSession: (channelId: number) =>
    apiFetch<{ success: boolean }>("/livekit/session/end", {
      method: "POST",
      body: JSON.stringify({ channelId }),
    }),

  // Optional: REST send message (temporary, until WS)
  sendMessage: (channelId: number, content: string) =>
    apiFetch<{ messageId: number }>(`/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
};
