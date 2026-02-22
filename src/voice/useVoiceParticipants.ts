import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";

export type VoiceChannelInfo = {
  id: number;
  name: string;
  livekitRoomName: string | null;
  participants: Array<{ id: string; username: string; displayName: string | null }>;
};

type VoiceParticipantsState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; channels: VoiceChannelInfo[] };

export function useVoiceParticipants(serverId: number | null) {
  const [state, setState] = useState<VoiceParticipantsState>({ status: "loading" });
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchParticipants = useCallback(async () => {
    if (!serverId) {
      setState({ status: "ready", channels: [] });
      return;
    }

    try {
      const data = await api.getVoiceParticipants(serverId);
      setState({ status: "ready", channels: data.channels });
    } catch (e: any) {
      setState({ status: "error", error: e?.message ?? "VOICE_PARTICIPANTS_ERROR" });
    }
  }, [serverId]);

  // Initial fetch and set up polling
  useEffect(() => {
    fetchParticipants().catch(console.error);

    // Poll every 1 second for live updates
    pollIntervalRef.current = setInterval(() => {
      fetchParticipants().catch(console.error);
    }, 1000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchParticipants]);

  return { state, refetch: fetchParticipants };
}
