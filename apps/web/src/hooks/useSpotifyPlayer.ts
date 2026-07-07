"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

interface SpotifyPlayerState {
  isReady: boolean;
  isPremium: boolean;
  deviceId: string | null;
  isPlaying: boolean;
  currentTrackUri: string | null;
  position: number;
  duration: number;
}

declare global {
  interface Window {
    Spotify: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume: number;
      }) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (data: any) => void) => void;
  removeListener: (event: string) => void;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  seek: (posMs: number) => Promise<void>;
  getCurrentState: () => Promise<any>;
}

async function fetchToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/auth/token`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token;
  } catch {
    return null;
  }
}

export function useSpotifyPlayer() {
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [state, setState] = useState<SpotifyPlayerState>({
    isReady: false,
    isPremium: false,
    deviceId: null,
    isPlaying: false,
    currentTrackUri: null,
    position: 0,
    duration: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
      if (!res.ok) return;
      const user = await res.json();
      if (!user.isPremium) {
        setState((s) => ({ ...s, isPremium: false }));
        return;
      }
      setState((s) => ({ ...s, isPremium: true }));

      if (document.getElementById("spotify-sdk-script")) return;

      const script = document.createElement("script");
      script.id = "spotify-sdk-script";
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.body.appendChild(script);

      window.onSpotifyWebPlaybackSDKReady = () => {
        if (cancelled) return;

        const player = new window.Spotify.Player({
          name: "DeepFuse",
          getOAuthToken: async (cb) => {
            const token = await fetchToken();
            if (token) cb(token);
          },
          volume: 0.8,
        });

        player.addListener("ready", ({ device_id }: { device_id: string }) => {
          setState((s) => ({ ...s, isReady: true, deviceId: device_id }));
        });

        player.addListener("not_ready", () => {
          setState((s) => ({ ...s, isReady: false, deviceId: null }));
        });

        player.addListener("player_state_changed", (spotifyState: any) => {
          if (!spotifyState) return;
          const track = spotifyState.track_window?.current_track;
          setState((s) => ({
            ...s,
            isPlaying: !spotifyState.paused,
            currentTrackUri: track?.uri ?? null,
            position: spotifyState.position,
            duration: spotifyState.duration,
          }));
        });

        player.addListener("initialization_error", ({ message }: { message: string }) => {
          console.error("Spotify SDK init error:", message);
        });

        player.addListener("authentication_error", ({ message }: { message: string }) => {
          console.error("Spotify SDK auth error:", message);
        });

        player.connect();
        playerRef.current = player;
      };
    }

    init();

    return () => {
      cancelled = true;
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Poll position while playing
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (state.isPlaying && playerRef.current) {
      intervalRef.current = setInterval(async () => {
        const s = await playerRef.current?.getCurrentState();
        if (s) {
          setState((prev) => ({ ...prev, position: s.position, duration: s.duration }));
        }
      }, 500);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.isPlaying]);

  const play = useCallback(
    async (trackUris: string[], offset = 0) => {
      if (!state.deviceId) return false;
      const token = await fetchToken();
      if (!token) return false;

      const res = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${state.deviceId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: trackUris, offset: { position: offset } }),
        }
      );
      return res.ok || res.status === 204;
    },
    [state.deviceId]
  );

  const togglePlay = useCallback(async () => {
    if (playerRef.current) await playerRef.current.togglePlay();
  }, []);

  const next = useCallback(async () => {
    if (playerRef.current) await playerRef.current.nextTrack();
  }, []);

  const prev = useCallback(async () => {
    if (playerRef.current) await playerRef.current.previousTrack();
  }, []);

  const seek = useCallback(async (posMs: number) => {
    if (playerRef.current) await playerRef.current.seek(posMs);
  }, []);

  return { ...state, play, togglePlay, next, prev, seek };
}
