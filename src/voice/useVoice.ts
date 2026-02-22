import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Room, Track } from "livekit-client";

const API_URL = import.meta.env.VITE_API_URL as string;

type VoiceState =
  | { status: "idle" }
  | { status: "connecting" }
  | {
      status: "connected";
      roomName: string;
      channelId: number;
      muted: boolean;
      cameraEnabled: boolean;
      screenShareEnabled: boolean;
      cameraFacing: "user" | "environment";
    }
  | { status: "error"; message: string };

export type VideoTrackEntry = {
  id: string;
  participantId: string;
  participantName: string;
  source: string;
  isLocal: boolean;
  track: Track;
  enabled: boolean;
};

export function useVoice() {
  const roomRef = useRef<Room | null>(null);
  const [state, setState] = useState<VoiceState>({ status: "idle" });
  const currentChannelIdRef = useRef<number | null>(null);
  const [videoTracks, setVideoTracks] = useState<VideoTrackEntry[]>([]);

  const leave = useCallback(() => {
    const room = roomRef.current;
    
    if (room) {
      room.disconnect();
      roomRef.current = null;
    }

    currentChannelIdRef.current = null;
    setVideoTracks([]);
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

      currentChannelIdRef.current = channelId;

      const room = new Room();
      roomRef.current = room;

      room.on("disconnected", (reason) => {
        console.log("LiveKit disconnected:", reason);
      });
      room.on("reconnecting", () => console.log("LiveKit reconnecting..."));
      room.on("reconnected", () => console.log("LiveKit reconnected"));

      const addVideoTrack = (
        track: Track,
        participant: { identity: string; name?: string },
        source: string,
        isLocal: boolean,
        trackIdHint?: string
      ) => {
        if (track.kind !== "video") return;

        const trackId =
          trackIdHint ||
          `${participant.identity}:${source}:${(track as any).sid ?? "video"}`;

        setVideoTracks((prev) => {
          if (prev.some((t) => t.track === track || t.id === trackId)) return prev;
          return [
            ...prev,
            {
              id: trackId,
              participantId: participant.identity,
              participantName: participant.name || participant.identity,
              source,
              isLocal,
              track,
              enabled: true,
            },
          ];
        });
      };

      const removeVideoTrack = (track: Track) => {
        if (track.kind !== "video") return;
        setVideoTracks((prev) => prev.filter((t) => t.track !== track));
      };

      room.on("trackSubscribed", (track, publication, participant) => {
        if (track.kind === "audio") {
          const audio = track.attach();
          audio.autoplay = true;
          audio.style.display = "none";
          document.body.appendChild(audio);
          return;
        }

        const source = String(publication?.source ?? (track as any).source ?? "camera");
        const trackId = String(publication?.trackSid ?? (track as any).sid ?? "remote");
        
        // Check if track is already muted when subscribing
        const isTrackMuted = (track as any).isMuted === true;
        
        setVideoTracks((prev) => {
          // Don't add muted remote tracks
          if (!prev.some((t) => t.track === track || t.id === trackId)) {
            return [
              ...prev,
              {
                id: trackId,
                participantId: participant.identity,
                participantName: participant.name || participant.identity,
                source,
                isLocal: false,
                track,
                enabled: !isTrackMuted,
              },
            ];
          }
          return prev;
        });

        // Listen for mute/unmute on remote tracks
        (track as any).on?.("muted", () => {
          setVideoTracks((prev) =>
            prev.map((t) => (t.track === track ? { ...t, enabled: false } : t))
          );
        });

        (track as any).on?.("unmuted", () => {
          setVideoTracks((prev) =>
            prev.map((t) => (t.track === track ? { ...t, enabled: true } : t))
          );
        });
      });

      room.on("trackUnsubscribed", (track, publication) => {
        removeVideoTrack(track);
      });

      room.on("localTrackPublished", (publication, participant) => {
        const track = publication.track;
        if (!track) return;
        const source = String(publication.source ?? (track as any).source ?? "camera");
        const trackId = String(publication.trackSid ?? (track as any).sid ?? "local");
        addVideoTrack(track, participant, source, true, trackId);

        // Listen for mute/unmute on local tracks too (in case they mute from elsewhere)
        (track as any).on?.("muted", () => {
          setVideoTracks((prev) =>
            prev.map((t) => (t.track === track ? { ...t, enabled: false } : t))
          );
        });

        (track as any).on?.("unmuted", () => {
          setVideoTracks((prev) =>
            prev.map((t) => (t.track === track ? { ...t, enabled: true } : t))
          );
        });
      });

      room.on("localTrackUnpublished", (publication) => {
        if (publication.track) {
          removeVideoTrack(publication.track);
        }
      });

      room.on("participantDisconnected", (participant) => {
        setVideoTracks((prev) => prev.filter((t) => t.participantId !== participant.identity));
      });

      await room.connect(url, token, { rtcConfig: { iceServers: iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }] } });

      await room.localParticipant.setMicrophoneEnabled(true);

      setState({
        status: "connected",
        roomName,
        channelId,
        muted: false,
        cameraEnabled: false,
        screenShareEnabled: false,
        cameraFacing: "user",
      });
    } catch (e: any) {
      roomRef.current?.disconnect();
      roomRef.current = null;
      currentChannelIdRef.current = null;
      setVideoTracks([]);
      setState({ status: "error", message: e?.message ?? "VOICE_ERROR" });
    }
  }, [leave]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const enabled = room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(!enabled);

    setState((prev) =>
      prev.status === "connected"
        ? { ...prev, muted: enabled }
        : prev
    );
  }, []);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const enabled = room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(!enabled);

    // Update enabled state for camera tracks
    setVideoTracks((prev) =>
      prev.map((t) =>
        t.isLocal && t.source.toLowerCase().includes("camera")
          ? { ...t, enabled: !enabled }
          : t
      )
    );

    setState((prev) =>
      prev.status === "connected"
        ? { ...prev, cameraEnabled: !enabled }
        : prev
    );
  }, []);

  const toggleCameraFacing = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const nextFacing =
      state.status === "connected" && state.cameraFacing === "environment"
        ? "user"
        : "environment";

    const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const track = pub?.track as any;
    if (track && typeof track.restartTrack === "function") {
      await track.restartTrack({ facingMode: nextFacing });
    }

    setState((prev) =>
      prev.status === "connected"
        ? { ...prev, cameraFacing: nextFacing }
        : prev
    );
  }, [state]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const enabled = room.localParticipant.isScreenShareEnabled;
    await room.localParticipant.setScreenShareEnabled(!enabled);

    // Update enabled state for screen share tracks
    setVideoTracks((prev) =>
      prev.map((t) =>
        t.isLocal && t.source.toLowerCase().includes("screen")
          ? { ...t, enabled: !enabled }
          : t
      )
    );

    setState((prev) =>
      prev.status === "connected"
        ? { ...prev, screenShareEnabled: !enabled }
        : prev
    );
  }, []);

  const sortedVideoTracks = useMemo(() => {
    return [...videoTracks]
      .filter((t) => t.enabled)
      .sort((a, b) => {
        if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
        if (a.participantName !== b.participantName) {
          return a.participantName.localeCompare(b.participantName);
        }
        return a.source.localeCompare(b.source);
      });
  }, [videoTracks]);

  // Cleanup on unmount
  useEffect(() => leave, [leave]);

  return {
    state,
    join,
    leave,
    toggleMute,
    toggleCamera,
    toggleCameraFacing,
    toggleScreenShare,
    videoTracks: sortedVideoTracks,
  };
}
