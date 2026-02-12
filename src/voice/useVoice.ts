import { useCallback, useEffect, useRef, useState } from "react";
import { Room } from "livekit-client";

const API_URL = import.meta.env.VITE_API_URL as string;

type VoiceState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; roomName: string; muted: boolean; participants: number }
  | { status: "error"; message: string };

export function useVoice() {
  const roomRef = useRef<Room | null>(null);
  const [state, setState] = useState<VoiceState>({ status: "idle" });

  const leave = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      room.disconnect();
      roomRef.current = null;
    }
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

      const { token, url, room: roomName } = await res.json();

      const room = new Room();
      roomRef.current = room;

      // Keep a simple participant count
      const updateCount = () => {
        const participants = 1 + room.remoteParticipants.size; // local + remote
        const muted = room.localParticipant.isMicrophoneEnabled === false;
        setState((prev) =>
          prev.status === "connected"
            ? { ...prev, participants, muted }
            : prev
        );
      };

      room
        .on("participantConnected", updateCount)
        .on("participantDisconnected", updateCount)
        .on("disconnected", () => {
          roomRef.current = null;
          setState({ status: "idle" });
        });

      room.on("trackSubscribed", (track, publication, participant) => {
        if (track.kind === "audio") {
          const audioEl = track.attach();
          audioEl.autoplay = true;
          document.body.appendChild(audioEl);
        }
      });

      await room.connect(url, token);
      
      room.on("trackSubscribed", (track) => {
        if (track.kind === "audio") {
          const audio = track.attach();
          audio.autoplay = true;
          audio.style.display = "none";
          document.body.appendChild(audio);
        }
      });

      await room.localParticipant.setMicrophoneEnabled(true);

      setState({
        status: "connected",
        roomName,
        muted: false,
        participants: 1 + room.remoteParticipants.size,
      });
    } catch (e: any) {
      roomRef.current?.disconnect();
      roomRef.current = null;
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
