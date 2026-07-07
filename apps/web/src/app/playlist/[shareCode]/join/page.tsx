"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

interface PlaylistInfo {
  id: string;
  name: string;
  creator: {
    displayName: string;
    profileImageUrl: string | null;
  };
}

export default function JoinPlaylistPage() {
  const params = useParams();
  const router = useRouter();
  const [playlist, setPlaylist] = useState<PlaylistInfo | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/playlists/${params.shareCode}`, { credentials: "include" }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`${API_URL}/auth/me`, { credentials: "include" }).then((r) => r.ok),
    ]).then(([pl, logged]) => {
      setPlaylist(pl);
      setIsLoggedIn(logged);
      setLoading(false);
    });
  }, [params.shareCode]);

  async function handleJoin() {
    if (!isLoggedIn) {
      const redirect = encodeURIComponent(`/playlist/${params.shareCode}/join`);
      window.location.href = `${API_URL}/auth/login?redirect=${redirect}`;
      return;
    }

    setJoining(true);
    const res = await fetch(`${API_URL}/api/playlists/${params.shareCode}/join`, {
      method: "POST",
      credentials: "include",
    });

    if (res.ok) {
      router.push(`/playlist/${params.shareCode}`);
    } else {
      setJoining(false);
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
        <button onClick={() => router.push("/")} className="font-semibold text-primary">
          Go home
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      {/* Tabs */}
      <div className="flex">
        <button
          onClick={() => router.push("/home")}
          className="flex-1 py-4 text-center text-sm font-semibold text-gray-300"
        >
          Create a playlist
        </button>
        <div className="flex-1 border-b-2 border-accent py-4 text-center text-sm font-semibold text-accent">
          Join a playlist
        </div>
      </div>

      {/* Content with purple overlay background */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/10 to-transparent" />

        {/* Large circle */}
        <div className="relative mb-10">
          <div className="flex h-64 w-64 items-center justify-center rounded-full bg-white shadow-xl ring-1 ring-gray-100">
            <div className="flex flex-col items-center gap-4">
              <h2 className="text-center text-xl font-bold text-gray-900">{playlist.name}</h2>

              <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-cyan-300 shadow-lg">
                {playlist.creator.profileImageUrl ? (
                  <img
                    src={playlist.creator.profileImageUrl}
                    alt={playlist.creator.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary text-2xl font-bold text-white">
                    {playlist.creator.displayName[0]}
                  </div>
                )}
              </div>

              <div className="text-center">
                <p className="text-xs text-gray-400">Created by</p>
                <p className="text-lg font-bold text-gray-900">{playlist.creator.displayName}</p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleJoin}
          disabled={joining}
          className="relative rounded-full bg-primary px-14 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-primary-light disabled:opacity-50"
        >
          {joining ? "Joining..." : "Join Playlist"}
        </button>
      </div>
    </div>
  );
}
