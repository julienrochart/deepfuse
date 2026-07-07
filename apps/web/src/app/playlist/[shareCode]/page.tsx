"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";

interface User {
  id: string;
  displayName: string;
  profileImageUrl: string | null;
}

interface Track {
  id: string;
  spotifyTrackId: string;
  name: string;
  artist: string;
  albumName: string;
  albumImageUrl: string | null;
  durationMs: number;
  previewUrl: string | null;
  position: number;
  addedBy?: { id: string; displayName: string } | null;
  energy: number | null;
  danceability: number | null;
  valence: number | null;
  tempo: number | null;
}

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  shareCode: string;
  isActive: boolean;
  creator: User;
  participants: { user: User; role: string }[];
  tracks: Track[];
}

const AVATAR_COLORS = [
  "border-red-400",
  "border-cyan-400",
  "border-purple-400",
  "border-yellow-400",
  "border-pink-400",
  "border-green-400",
  "border-blue-400",
  "border-orange-400",
];

function formatDuration(ms: number) {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function PlaylistPage() {
  const params = useParams();
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [fusing, setFusing] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [featuresTrackId, setFeaturesTrackId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const showTracklist = true;

  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);

  const spotify = useSpotifyPlayer();
  const useSDK = spotify.isPremium && spotify.isReady;

  const fetchPlaylist = useCallback(() => {
    return fetch(`/api/playlists/${params.shareCode}`, { credentials: "include" })
      .then((r) => r.json())
      .then((pl) => setPlaylist(pl));
  }, [params.shareCode]);

  useEffect(() => {
    Promise.all([
      fetchPlaylist(),
      fetch("/auth/me", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
    ]).then(([, user]) => {
      setCurrentUser(user);
      setLoading(false);
    });
  }, [fetchPlaylist]);

  useEffect(() => {
    const interval = setInterval(fetchPlaylist, 5000);
    return () => clearInterval(interval);
  }, [fetchPlaylist]);

  useEffect(() => {
    if (useSDK) return;
    const audio = new Audio();
    audioRef.current = audio;
    audio.addEventListener("timeupdate", () => {
      setPreviewProgress(audio.currentTime);
      setPreviewDuration(audio.duration || 0);
    });
    audio.addEventListener("ended", () => {
      if (!playlist?.tracks.length) return;
      setCurrentTrackIndex((i) => (i < playlist.tracks.length - 1 ? i + 1 : 0));
    });
    audio.addEventListener("pause", () => setPreviewPlaying(false));
    audio.addEventListener("play", () => setPreviewPlaying(true));
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [useSDK]);

  useEffect(() => {
    if (useSDK) return;
    const audio = audioRef.current;
    if (!audio || !playlist?.tracks.length) return;
    const track = playlist.tracks[currentTrackIndex];
    if (track?.previewUrl) {
      const wasPlaying = previewPlaying;
      audio.src = track.previewUrl;
      audio.load();
      if (wasPlaying) audio.play().catch(() => {});
    } else {
      audio.src = "";
      setPreviewPlaying(false);
    }
    setPreviewProgress(0);
  }, [currentTrackIndex, playlist?.tracks, useSDK]);

  useEffect(() => {
    if (!useSDK || !spotify.currentTrackUri || !playlist?.tracks.length) return;
    const idx = playlist.tracks.findIndex(
      (t) => `spotify:track:${t.spotifyTrackId}` === spotify.currentTrackUri
    );
    if (idx >= 0 && idx !== currentTrackIndex) setCurrentTrackIndex(idx);
  }, [spotify.currentTrackUri, useSDK]);

  const isPlaying = useSDK ? spotify.isPlaying : previewPlaying;
  const progress = useSDK ? spotify.position / 1000 : previewProgress;
  const duration = useSDK
    ? spotify.duration / 1000
    : previewDuration || (playlist?.tracks[currentTrackIndex]?.durationMs ?? 0) / 1000;

  const handlePlayPause = useCallback(async () => {
    if (!playlist?.tracks.length) return;

    // Try Spotify SDK first (Premium users)
    if (useSDK) {
      if (!spotify.isPlaying && !spotify.currentTrackUri) {
        const uris = playlist.tracks.map((t) => `spotify:track:${t.spotifyTrackId}`);
        await spotify.play(uris, currentTrackIndex);
      } else {
        await spotify.togglePlay();
      }
      return;
    }

    // Try SDK even if not fully "ready" yet
    if (spotify.isPremium && spotify.deviceId) {
      const uris = playlist.tracks.map((t) => `spotify:track:${t.spotifyTrackId}`);
      await spotify.play(uris, currentTrackIndex);
      return;
    }

    // Fallback: preview URL (Free users or SDK not connected)
    const audio = audioRef.current;
    if (!audio) return;
    const track = playlist.tracks[currentTrackIndex];
    if (!track?.previewUrl) {
      // Skip to next track that has a preview
      const nextWithPreview = playlist.tracks.findIndex(
        (t, i) => i > currentTrackIndex && t.previewUrl
      );
      if (nextWithPreview >= 0) {
        setCurrentTrackIndex(nextWithPreview);
      }
      return;
    }
    if (previewPlaying) {
      audio.pause();
    } else {
      if (!audio.src || audio.src !== track.previewUrl) {
        audio.src = track.previewUrl;
        audio.load();
      }
      audio.play().catch(() => {});
    }
  }, [useSDK, spotify, playlist, currentTrackIndex, previewPlaying]);

  const handlePrev = useCallback(async () => {
    if (!playlist?.tracks.length) return;
    if (useSDK) await spotify.prev();
    else setCurrentTrackIndex((i) => (i > 0 ? i - 1 : playlist.tracks.length - 1));
  }, [useSDK, spotify, playlist]);

  const handleNext = useCallback(async () => {
    if (!playlist?.tracks.length) return;
    if (useSDK) await spotify.next();
    else setCurrentTrackIndex((i) => (i < playlist.tracks.length - 1 ? i + 1 : 0));
  }, [useSDK, spotify, playlist]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      if (useSDK) spotify.seek(pct * duration * 1000);
      else if (audioRef.current) audioRef.current.currentTime = pct * duration;
    },
    [useSDK, spotify, duration]
  );

  const handleSelectTrack = useCallback(
    async (index: number) => {
      setCurrentTrackIndex(index);
      if (useSDK && playlist?.tracks.length) {
        const uris = playlist.tracks.map((t) => `spotify:track:${t.spotifyTrackId}`);
        await spotify.play(uris, index);
      }
    },
    [useSDK, spotify, playlist]
  );

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const shareUrl = `${window.location.origin}/playlist/${playlist!.shareCode}/join`;
      const canShare =
        typeof navigator.share === "function" && navigator.canShare?.({ url: shareUrl });
      if (canShare) await navigator.share({ url: shareUrl });
      else {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link copied!");
      }
    } catch {
      /* user cancelled share */
    } finally {
      setSharing(false);
      setShowMenu(false);
    }
  }

  async function handleStop() {
    if (!confirm("Stop this playlist? No one will be able to join or play it anymore.")) return;
    const res = await fetch(`/api/playlists/${params.shareCode}/stop`, {
      method: "PATCH",
      credentials: "include",
    });
    if (res.ok) {
      setPlaylist((prev) => (prev ? { ...prev, isActive: false } : prev));
      if (isPlaying) {
        if (useSDK) spotify.togglePlay();
        else audioRef.current?.pause();
      }
    }
  }

  async function handleFuse() {
    if (fusing) return;
    setFusing(true);
    try {
      const res = await fetch(`/api/playlists/${params.shareCode}/fuse`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const updated = await res.json();
        setPlaylist(updated);
        setCurrentTrackIndex(0);
      } else {
        const err = await res.json();
        alert(err.error || "Fusion failed");
      }
    } catch {
      alert("Fusion failed");
    } finally {
      setFusing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
        <p className="text-gray-500">Playlist not found</p>
        <button onClick={() => router.push("/home")} className="font-semibold text-primary">
          Go home
        </button>
      </div>
    );
  }

  const isCreator = currentUser?.id === playlist.creator.id;
  const currentTrack = playlist.tracks[currentTrackIndex];
  const hasTracks = playlist.tracks.length > 0;
  const canPlay = hasTracks && playlist.isActive;
  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="relative flex min-h-dvh flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => router.push("/home")} className="p-1 text-gray-700">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="max-w-[200px] truncate text-center text-lg font-bold text-gray-900">
          {playlist.name}
        </h1>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 text-gray-700">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl bg-white py-2 shadow-xl ring-1 ring-gray-100">
                <button
                  onClick={handleShare}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  Share link
                </button>
                {isCreator && playlist.isActive && hasTracks && (
                  <button
                    onClick={handleFuse}
                    disabled={fusing}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.3" />
                    </svg>
                    {fusing ? "Fusing..." : "Refresh fusion"}
                  </button>
                )}
                {isCreator && playlist.isActive && (
                  <button
                    onClick={handleStop}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-500 hover:bg-gray-50"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    Stop playlist
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {!playlist.isActive && (
        <div className="mx-4 mb-2 rounded-xl bg-red-50 px-4 py-2.5 text-center text-sm font-medium text-red-600">
          This playlist has been stopped
        </div>
      )}

      {hasTracks ? (
        <>
          {/* Vinyl + tonearm + participants */}
          <div className="relative flex flex-col items-center px-4 pb-2 pt-2">
            <div className="relative" style={{ width: 340, height: 360 }}>
              {/* Vinyl disc */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div
                  className={`relative h-[220px] w-[220px] rounded-full bg-gray-950 shadow-2xl ${isPlaying ? "animate-spin" : ""}`}
                  style={isPlaying ? { animationDuration: "3s" } : {}}
                >
                  {/* Vinyl grooves */}
                  <div className="absolute inset-3 rounded-full border border-gray-800" />
                  <div className="absolute inset-6 rounded-full border border-gray-800" />
                  <div className="absolute inset-10 rounded-full border border-gray-800/50" />
                  <div className="absolute inset-14 rounded-full border border-gray-800/50" />
                  {/* Album art center */}
                  <div className="absolute left-1/2 top-1/2 h-[80px] w-[80px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-[3px] border-gray-800">
                    {currentTrack?.albumImageUrl ? (
                      <img
                        src={currentTrack.albumImageUrl}
                        alt={currentTrack.albumName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-800">
                        <div className="h-3 w-3 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                  {/* Center hole */}
                  <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                </div>
              </div>

              {/* Tonearm */}
              <div className="absolute right-6 top-0 z-10">
                <svg width="60" height="160" viewBox="0 0 60 160">
                  {/* Pivot base */}
                  <circle cx="40" cy="18" r="14" fill="#4A3AFF" />
                  <circle cx="40" cy="18" r="8" fill="#3628CC" />
                  {/* Arm */}
                  <line
                    x1="40"
                    y1="26"
                    x2="18"
                    y2="130"
                    stroke="#8B8B9E"
                    strokeWidth="4"
                    strokeLinecap="round"
                    transform={isPlaying ? "rotate(5, 40, 18)" : "rotate(-5, 40, 18)"}
                    className="transition-transform duration-1000"
                  />
                  {/* Headshell */}
                  <rect
                    x="10"
                    y="126"
                    width="12"
                    height="20"
                    rx="2"
                    fill="#4A3AFF"
                    transform={isPlaying ? "rotate(5, 40, 18)" : "rotate(-5, 40, 18)"}
                    className="transition-transform duration-1000"
                  />
                </svg>
              </div>

              {/* Participant avatars around the disc */}
              {playlist.participants.map((p, i) => {
                const total = playlist.participants.length;
                const angle = (i / total) * 360 - 90;
                const rad = (angle * Math.PI) / 180;
                const radius = 150;
                const cx = 170 + Math.cos(rad) * radius;
                const cy = 180 + Math.sin(rad) * radius;
                const colorClass = AVATAR_COLORS[i % AVATAR_COLORS.length];

                return (
                  <div
                    key={p.user.id}
                    className="absolute flex flex-col items-center"
                    style={{ left: cx, top: cy, transform: "translate(-50%, -50%)" }}
                  >
                    <div
                      className={`h-11 w-11 overflow-hidden rounded-full border-[3px] shadow-md ${colorClass}`}
                    >
                      {p.user.profileImageUrl ? (
                        <img
                          src={p.user.profileImageUrl}
                          alt={p.user.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-primary text-sm font-bold text-white">
                          {p.user.displayName[0]}
                        </div>
                      )}
                    </div>
                    {isCreator && p.role !== "creator" && playlist.isActive && (
                      <button
                        onClick={async () => {
                          if (!confirm(`Remove ${p.user.displayName}?`)) return;
                          const res = await fetch(
                            `/api/playlists/${params.shareCode}/participants/${p.user.id}`,
                            { method: "DELETE", credentials: "include" }
                          );
                          if (res.ok)
                            setPlaylist((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    participants: prev.participants.filter(
                                      (pp) => pp.user.id !== p.user.id
                                    ),
                                  }
                                : prev
                            );
                        }}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white shadow"
                      >
                        x
                      </button>
                    )}
                    <span className="mt-0.5 max-w-[60px] truncate text-center text-[10px] text-gray-500">
                      {p.user.displayName.split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Track info */}
          <div className="flex flex-col items-center gap-0.5 px-6 pt-2">
            <h2 className="text-center text-xl font-bold text-gray-900">{currentTrack.name}</h2>
            <p className="text-sm text-gray-400">{currentTrack.artist}</p>
          </div>

          {/* Timeline */}
          <div className="flex items-center gap-3 px-8 pt-5">
            <span className="w-10 text-right text-xs tabular-nums text-gray-400">
              {formatDuration(progress * 1000)}
            </span>
            <div
              className="relative flex h-4 flex-1 cursor-pointer items-center"
              onClick={handleSeek}
            >
              <div className="h-1 w-full rounded-full bg-gray-200">
                <div
                  className="h-1 rounded-full bg-primary transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div
                className="absolute h-3.5 w-3.5 rounded-full bg-primary shadow"
                style={{ left: `calc(${progressPct}% - 7px)` }}
              />
            </div>
            <span className="w-10 text-xs tabular-nums text-gray-400">
              {formatDuration(duration * 1000)}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-10 py-5">
            <button onClick={handlePrev} className="text-gray-300 transition hover:text-gray-500">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>
            <button
              onClick={handlePlayPause}
              disabled={!canPlay}
              className="flex h-16 w-16 items-center justify-center rounded-full border-[2.5px] border-primary text-primary transition hover:bg-primary hover:text-white disabled:border-gray-200 disabled:text-gray-200"
            >
              {isPlaying ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button onClick={handleNext} className="text-gray-300 transition hover:text-gray-500">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>

          {/* Playback mode badge */}
          <div className="flex justify-center pb-2">
            <span
              className={`rounded-full px-3 py-0.5 text-[10px] font-medium ${
                useSDK
                  ? "bg-green-50 text-green-600"
                  : spotify.isPremium
                    ? "bg-yellow-50 text-yellow-600"
                    : "bg-gray-50 text-gray-400"
              }`}
            >
              {useSDK
                ? "Spotify Premium"
                : spotify.isPremium
                  ? "Connecting to Spotify..."
                  : currentTrack?.previewUrl
                    ? "Preview 30s"
                    : "Open in Spotify to listen"}
            </span>
          </div>

          {/* Tracklist */}
          <div className="flex-1 border-t border-gray-100">
            <div className="px-6 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {playlist.tracks.length} tracks
              </span>
            </div>

            <div className="max-h-[40vh] overflow-y-auto px-4 pb-4">
              {playlist.tracks.map((track, i) => (
                <div key={track.id} className="relative">
                  <div
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${
                      i === currentTrackIndex ? "bg-primary/5" : "hover:bg-gray-50"
                    }`}
                  >
                    <button
                      onClick={() => handleSelectTrack(i)}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg">
                        {track.albumImageUrl ? (
                          <img
                            src={track.albumImageUrl}
                            alt={track.albumName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-400">
                            ?
                          </div>
                        )}
                        {i === currentTrackIndex && isPlaying && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                              <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm font-medium ${i === currentTrackIndex ? "text-primary" : "text-gray-900"}`}
                        >
                          {track.name}
                        </p>
                        <p className="truncate text-xs text-gray-400">
                          {track.artist}
                          {track.addedBy?.displayName && (
                            <span className="text-gray-300">
                              {" "}
                              · {track.addedBy.displayName.split(" ")[0]}
                            </span>
                          )}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFeaturesTrackId(featuresTrackId === track.id ? null : track.id);
                      }}
                      className="flex-shrink-0 p-1.5 text-gray-300 transition hover:text-primary"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </button>
                    <span className="text-xs tabular-nums text-gray-300">
                      {formatDuration(track.durationMs)}
                    </span>
                  </div>
                  {featuresTrackId === track.id && (
                    <div className="mx-2 mb-1 rounded-lg bg-gray-50 px-3 py-2">
                      {track.energy != null ? (
                        <div className="grid grid-cols-4 gap-2 text-center">
                          {[
                            { label: "Energy", value: track.energy },
                            { label: "Dance", value: track.danceability },
                            { label: "Mood", value: track.valence },
                            { label: "BPM", value: track.tempo, isBpm: true },
                          ].map((f) => (
                            <div key={f.label}>
                              <p className="text-[10px] text-gray-400">{f.label}</p>
                              <p className="text-xs font-semibold text-primary">
                                {f.isBpm
                                  ? Math.round(f.value ?? 0)
                                  : `${Math.round((f.value ?? 0) * 100)}%`}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-xs text-gray-400">
                          Relance la fusion pour voir les audio features
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
          {/* Empty vinyl */}
          <div className="relative">
            <div className="h-48 w-48 rounded-full bg-gray-950 shadow-xl">
              <div className="absolute inset-4 rounded-full border border-gray-800" />
              <div className="absolute inset-8 rounded-full border border-gray-800" />
              <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gray-800">
                <div className="h-3 w-3 rounded-full bg-white" />
              </div>
            </div>
          </div>

          <p className="text-center text-gray-400">
            {playlist.participants.length < 2
              ? "Share the link to invite participants"
              : `${playlist.participants.length} participants ready`}
          </p>

          {isCreator && playlist.participants.length >= 1 && (
            <button
              onClick={handleFuse}
              disabled={fusing}
              className="rounded-full bg-gradient-to-r from-accent to-gradient-end px-10 py-4 font-bold text-white shadow-lg transition hover:shadow-xl disabled:opacity-50"
            >
              {fusing ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Fusing tracks...
                </span>
              ) : (
                "Fuse & Play"
              )}
            </button>
          )}
        </div>
      )}

      {/* Bottom nav */}
      <nav className="mt-auto flex border-t border-gray-100 py-3">
        <button className="flex flex-1 flex-col items-center gap-1 text-gray-300">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span className="text-[10px]">Search</span>
        </button>
        <button className="flex flex-1 flex-col items-center gap-1 text-primary">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" />
          </svg>
          <span className="text-[10px] font-semibold">Play</span>
          <div className="h-1 w-1 rounded-full bg-primary" />
        </button>
        <button
          onClick={() => router.push("/home")}
          className="flex flex-1 flex-col items-center gap-1 text-gray-300"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
          <span className="text-[10px]">Playlists</span>
        </button>
      </nav>
    </div>
  );
}
