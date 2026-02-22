import { useCallback, useEffect, useRef, useState } from "react";
import { Room } from "livekit-client";
import { api } from "../api";

const API_URL = import.meta.env.VITE_API_URL as string;

type VoiceState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; roomName: string; channelId: number; muted: boolean; participants: number }
  | { status: "error"; message: string };

export function useVoice() {
  const roomRef = useRef<Room | null>(null);
  const [state, setState] = useState<VoiceState>({ status: "idle" });
  const currentChannelIdRef = useRef<number | null>(null);

  const leave = useCallback(() => {
    const room = roomRef.current;
    const channelId = currentChannelIdRef.current;
    
    if (room) {
      room.disconnect();
      roomRef.current = null;
    }

    // Track session end
    if (channelId) {
      api.endVoiceSession(channelId).catch((e) => {
        console.error("Failed to end voice session:", e);
      });
    }

    currentChannelIdRef.current = null;
    setState({ status: "idle" });
  }, []);

  const join = useCallback(async (channelId: number) => {
    // If already connected, leave first
    leave();
    setState({ status: "connecting" });

    try {
      const res = await fetch(`${API_URL}/livekit/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ channelId }),
      });

      if (!res.ok) {
        let err = "TOKEN_FAILED";
        try {
          const j = await res.json();
          err = j?.error ?? err;
        } catch {}
        throw new Error(err);
      }

      const json = await res.json();
      const { token, url, room: roomName, iceServers } = json as any;

      // Track session start
      await api.startVoiceSession(channelId);
      currentChannelIdRef.current = channelId;

      const room = new Room();
      roomRef.current = room;

      room.on("disconnected", (reason) => {
        console.log("LiveKit disconnected:", reason);
      });
      room.on("reconnecting", () => console.log("LiveKit reconnecting..."));
      room.on("reconnected", () => console.log("LiveKit reconnected"));

      room.on("trackSubscribed", (track) => {
        if (track.kind === "audio") {
          const audio = track.attach();
          audio.autoplay = true;
          audio.style.display = "none";
          document.body.appendChild(audio);
        }
      });

      await room.connect(url, token, { rtcConfig: { iceServers: iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }] } });

      await room.localParticipant.setMicrophoneEnabled(true);

      setState({
        status: "connected",
        roomName,
        channelId,
        muted: false,
        participants: 1 + room.remoteParticipants.size,
      });
    } catch (e: any) {
      roomRef.current?.disconnect();
      roomRef.current = null;
      currentChannelIdRef.current = null;
      setState({ status: "error", message: e?.message ?? "VOICE_ERROR" });
    }
  }, [leave]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const enabled = room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(!enabled);

    const participants = 1 + room.remoteParticipants.size;
    setState((prev) =>
      prev.status === "connected"
        ? { ...prev, muted: enabled, participants }
        : prev
    );
  }, []);

  // Cleanup on unmount
  useEffect(() => leave, [leave]);

  return { state, join, leave, toggleMute };
}
