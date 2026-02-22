import { useEffect, useMemo, useRef } from "react";
import type { Channel } from "../types";
import type { VideoTrackEntry } from "../voice/useVoice";

type VoiceControlState =
	| { status: "idle" }
	| { status: "connecting" }
	| {
			status: "connected";
			roomName: string;
			channelId: number;
			muted: boolean;
			cameraEnabled: boolean;
			screenShareEnabled: boolean;
		}
	| { status: "error"; message: string };

type VoiceController = {
	state: VoiceControlState;
	join: (channelId: number) => Promise<void>;
	leave: () => void;
	toggleMute: () => Promise<void>;
	toggleCamera: () => Promise<void>;
	toggleScreenShare: () => Promise<void>;
	videoTracks: VideoTrackEntry[];
};

function VideoTile({ track, label, isLocal }: { track: VideoTrackEntry; label: string; isLocal: boolean }) {
	const videoRef = useRef<HTMLVideoElement | null>(null);

	useEffect(() => {
		const el = videoRef.current;
		if (!el) return;
		track.track.attach(el);
		el.muted = isLocal;
		el.playsInline = true;
		return () => {
			track.track.detach(el);
		};
	}, [track, isLocal]);

	return (
		<div
			style={{
				position: "relative",
				borderRadius: 10,
				overflow: "hidden",
				background: "#111",
				minHeight: 160,
				paddingBottom: "100%",
				aspectRatio: "1 / 1",
				width: "100%",
			}}
		>
			<video
				ref={videoRef}
				autoPlay
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					objectFit: "cover",
				}}
			/>
			<div
				style={{
					position: "absolute",
					left: 8,
					bottom: 8,
					padding: "4px 8px",
					borderRadius: 999,
					fontSize: 11,
					background: "rgba(0,0,0,0.6)",
					color: "white",
					maxWidth: "calc(100% - 16px)",
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
				title={label}
			>
				{label}
			</div>
		</div>
	);
}

export function VoiceParticipants({
	activeChannel,
	voice,
	onJoinVoice,
	onLeaveVoice,
}: {
	activeChannel: Channel | null;
	voice: VoiceController;
	onJoinVoice: (channelId: number) => Promise<void>;
	onLeaveVoice: () => Promise<void>;
}) {
	const isVoiceChannel = activeChannel?.type === "voice";

	const trackTiles = useMemo(() => {
		return voice.videoTracks.map((track) => {
			const sourceLabel = track.source.toLowerCase().includes("screen") ? "Screen" : "Camera";
			const label = `${track.isLocal ? "You" : track.participantName} · ${sourceLabel}`;
			return (
				<VideoTile
					key={track.id}
					track={track}
					isLocal={track.isLocal}
					label={label}
				/>
			);
		});
	}, [voice.videoTracks]);

	if (!isVoiceChannel) {
		return (
			<div style={{ padding: 12, borderTop: "1px solid #ddd", opacity: 0.7 }}>
				Select a text channel to send messages.
			</div>
		);
	}

	return (
		<div style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100%", minHeight: 0 }}>
			<div
				style={{
					padding: 12,
					borderBottom: "1px solid #ddd",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 8,
					flexWrap: "wrap",
					minHeight: "44px",
				}}
			>
				<div style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
					Voice: {activeChannel?.name}
				</div>
				<div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
					{voice.state.status === "idle" && (
						<button onClick={() => onJoinVoice(activeChannel!.id)} style={{ minHeight: "36px", padding: "6px 12px" }}>
							Join Voice
						</button>
					)}
					{voice.state.status === "connecting" && <div style={{ alignSelf: "center" }}>Connecting...</div>}
					{voice.state.status === "connected" && (
						<>
							<button
								onClick={() => voice.toggleMute().catch(console.error)}
								style={{ minHeight: "36px", padding: "6px 12px", fontSize: "0.9rem" }}
							>
								{voice.state.muted ? "Unmute" : "Mute"}
							</button>
							<button
								onClick={() => voice.toggleCamera().catch(console.error)}
								style={{ minHeight: "36px", padding: "6px 12px", fontSize: "0.9rem" }}
							>
								{voice.state.cameraEnabled ? "Stop Cam" : "Camera"}
							</button>
							<button
								onClick={() => voice.toggleScreenShare().catch(console.error)}
								style={{ minHeight: "36px", padding: "6px 12px", fontSize: "0.9rem" }}
							>
								{voice.state.screenShareEnabled ? "Stop Share" : "Share"}
							</button>
							<button
								onClick={() => onLeaveVoice()}
								style={{ minHeight: "36px", padding: "6px 12px", background: "#dc3545", color: "white" }}
							>
								Leave
							</button>
						</>
					)}
				</div>
			</div>

			<div style={{ padding: 12, overflow: "auto", minHeight: 0 }}>
				{voice.state.status === "error" && (
					<div style={{ color: "crimson", marginBottom: 8, padding: "8px", backgroundColor: "rgba(220, 53, 69, 0.1)", borderRadius: "4px" }}>
						Voice error: {voice.state.message}
					</div>
				)}

				{voice.state.status !== "connected" && (
					<div style={{ opacity: 0.7 }}>Join voice to start video or screen sharing.</div>
				)}

				{voice.state.status === "connected" && trackTiles.length === 0 && (
					<div style={{ opacity: 0.7 }}>No video streams yet.</div>
				)}

				{trackTiles.length > 0 && (
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
							gap: 12,
						}}
					>
						{trackTiles}
					</div>
				)}

				<style>{`
					@media (max-width: 768px) {
						div {
							padding: 8px;
						}
					}
					@media (max-width: 480px) {
						div {
							gridTemplateColumns: repeat(auto-fit, minmax(140px, 1fr));
							gap: 8px;
						}
						button {
							padding: 6px 8px;
							font-size: 0.8rem;
						}
					}
				`}</style>
			</div>
		</div>
	);
}
