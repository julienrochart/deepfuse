"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

interface User {
  id: string;
  displayName: string;
  profileImageUrl: string | null;
  isPremium: boolean;
}

interface PlaylistSummary {
  id: string;
  name: string;
  shareCode: string;
  creator: { displayName: string; profileImageUrl: string | null };
  _count: { tracks: number };
  participants: { user: { displayName: string; profileImageUrl: string | null } }[];
}

type Tab = "create" | "join";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("create");
  const [showProfile, setShowProfile] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/auth/me`, { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_URL}/api/playlists`, { credentials: "include" }).then((r) =>
        r.ok ? r.json() : []
      ),
    ])
      .then(([u, pls]) => {
        if (!u) {
          window.location.href = "/";
          return;
        }
        setUser(u);
        setPlaylists(pls);
        setLoading(false);
      })
      .catch(() => {
        window.location.href = "/";
      });
  }, []);

  async function handleLogout() {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = "/";
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinError(null);

    const input = joinCode.trim();
    const match = input.match(/\/playlist\/([^/]+)\/join/) || input.match(/\/playlist\/([^/]+)/);
    const shareCode = match ? match[1] : input;

    try {
      const res = await fetch(`${API_URL}/api/playlists/${shareCode}/join`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        router.push(`/playlist/${shareCode}`);
      } else {
        const data = await res.json();
        setJoinError(data.error || "Could not join playlist");
      }
    } catch {
      setJoinError("Connection error");
    } finally {
      setJoining(false);
    }
  }

  async function handleDeleteAccount() {
    if (!confirm("Are you sure? All your playlists and data will be permanently deleted.")) return;
    const res = await fetch(`${API_URL}/auth/account`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      {/* Top bar with avatar */}
      <div className="flex items-center justify-between px-5 pt-4">
        <div />
        <div className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="h-9 w-9 overflow-hidden rounded-full border-2 border-gray-200"
          >
            {user?.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={user.displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary text-sm font-bold text-white">
                {user?.displayName[0]}
              </div>
            )}
          </button>
          {showProfile && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowProfile(false)} />
              <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-xl bg-white py-2 shadow-xl ring-1 ring-gray-100">
                <div className="border-b px-4 py-2">
                  <p className="text-sm font-semibold text-gray-900">{user?.displayName}</p>
                  <p className="text-xs text-gray-400">
                    {user?.isPremium ? "Spotify Premium" : "Spotify Free"}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
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
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  Log out
                </button>
                <button
                  onClick={handleDeleteAccount}
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
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                  Delete account
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex">
        <button
          onClick={() => setActiveTab("create")}
          className={`flex-1 py-4 text-center text-sm font-semibold transition ${
            activeTab === "create" ? "border-b-2 border-accent text-accent" : "text-gray-300"
          }`}
        >
          Create a playlist
        </button>
        <button
          onClick={() => setActiveTab("join")}
          className={`flex-1 py-4 text-center text-sm font-semibold transition ${
            activeTab === "join" ? "border-b-2 border-accent text-accent" : "text-gray-300"
          }`}
        >
          Join a playlist
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col px-5 py-6">
        {activeTab === "create" ? (
          <div className="flex flex-col gap-5">
            {/* Create card */}
            <button
              onClick={() => router.push("/playlist/new")}
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 px-8 py-12 text-left"
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10" />
              <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-accent/10" />
              <div className="relative">
                <h2 className="mb-3 text-2xl font-bold text-gray-900">Create your own</h2>
                <p className="mb-6 text-sm text-accent">
                  The crowd can manually add songs to the playlist
                </p>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary text-primary">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>

            {/* Existing playlists */}
            {playlists.length > 0 && (
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  My playlists
                </h3>
                <div className="flex flex-col gap-2">
                  {playlists.map((pl) => (
                    <div
                      key={pl.id}
                      className="group flex items-center gap-4 rounded-2xl bg-gray-50 px-4 py-3 transition hover:bg-gray-100"
                    >
                      <button
                        onClick={() => router.push(`/playlist/${pl.shareCode}`)}
                        className="flex min-w-0 flex-1 items-center gap-4 text-left"
                      >
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-900">
                          <div className="h-4 w-4 rounded-full bg-gray-700">
                            <div className="mx-auto mt-1.5 h-1 w-1 rounded-full bg-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">{pl.name}</p>
                          <p className="text-xs text-gray-400">
                            {pl.participants.length} participant
                            {pl.participants.length > 1 ? "s" : ""} · {pl._count.tracks} tracks
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`Delete "${pl.name}"?`)) return;
                          const res = await fetch(`${API_URL}/api/playlists/${pl.shareCode}`, {
                            method: "DELETE",
                            credentials: "include",
                          });
                          if (res.ok) setPlaylists((prev) => prev.filter((p) => p.id !== pl.id));
                        }}
                        className="flex-shrink-0 p-1 text-gray-300 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center gap-6 pt-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/5">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-primary"
              >
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <div className="w-full max-w-xs text-center">
              <h2 className="mb-1 text-lg font-bold text-gray-900">Join a playlist</h2>
              <p className="mb-6 text-sm text-gray-400">
                Paste a shared link or enter a playlist code
              </p>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value);
                  setJoinError(null);
                }}
                placeholder="Link or code..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-sm text-gray-900 placeholder:text-gray-300 focus:border-primary focus:outline-none"
              />
              {joinError && <p className="mt-2 text-xs text-red-500">{joinError}</p>}
              <button
                onClick={handleJoin}
                disabled={!joinCode.trim() || joining}
                className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition disabled:opacity-40"
              >
                {joining ? "Joining..." : "Join"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="flex border-t border-gray-100 py-3">
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
          onClick={() => setActiveTab("create")}
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
