import type { User, Server, Channel, Message } from "./types";

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
  logout: () =>
    apiFetch<void>("/auth/logout", {
      method: "POST",
    }),

  // Read models
  listServers: () => apiFetch<{ servers: Server[] }>("/servers"),
  listChannels: (serverId: number) =>
    apiFetch<{ channels: Channel[] }>(`/servers/${serverId}/channels`),
  listMessages: (channelId: number, limit = 50, before?: number) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (before) qs.set("before", String(before));
    return apiFetch<{ messages: Message[]; nextCursor: number | null }>(
      `/channels/${channelId}/messages?${qs.toString()}`
    );
  },

  // Optional: REST send message (temporary, until WS)
  sendMessage: (channelId: number, content: string) =>
    apiFetch<{ messageId: number }>(`/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
};
