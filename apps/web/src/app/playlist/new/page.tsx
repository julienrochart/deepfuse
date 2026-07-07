"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

interface User {
  id: string;
  displayName: string;
  profileImageUrl: string | null;
}

interface Participant {
  user: User;
  role: string;
}

export default function NewPlaylistPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/auth/me`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          router.push("/");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setCurrentUser(data);
      });
  }, [router]);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);

    try {
      const res = await fetch(`${API_URL}/api/playlists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });

      if (!res.ok) throw new Error("Failed to create playlist");

      const playlist = await res.json();
      router.push(`/playlist/${playlist.shareCode}`);
    } catch {
      setCreating(false);
    }
  }

  async function handlePreCreate() {
    if (!name.trim()) return;
    if (shareCode) return;
    setCreating(true);

    try {
      const res = await fetch(`${API_URL}/api/playlists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });

      if (!res.ok) throw new Error("Failed to create playlist");

      const playlist = await res.json();
      setShareCode(playlist.shareCode);
      setParticipants([{ user: currentUser!, role: "creator" }]);
      setCreating(false);
    } catch {
      setCreating(false);
    }
  }

  async function handleShareLink() {
    if (!shareCode && !name.trim()) return;

    if (!shareCode) {
      await handlePreCreate();
    }

    const code = shareCode;
    if (!code) return;

    const shareUrl = `${window.location.origin}/playlist/${code}/join`;

    if (navigator.share) {
      await navigator.share({
        title: `Join "${name}" on DeepFuse`,
        text: "Join my collaborative playlist!",
        url: shareUrl,
      });
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert("Link copied to clipboard!");
    }
  }

  async function handleFinalCreate() {
    if (!shareCode) {
      await handleCreate();
      return;
    }
    router.push(`/playlist/${shareCode}`);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4">
        <button onClick={() => router.back()} className="text-gray-600">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">New Playlist</h1>
        <button
          onClick={handleFinalCreate}
          disabled={!name.trim() || creating}
          className="font-semibold text-primary disabled:text-gray-300"
        >
          {creating ? "..." : "Create"}
        </button>
      </header>

      {/* Form */}
      <div className="flex flex-col gap-6 px-6 py-4">
        {/* Name & Description card */}
        <div className="rounded-2xl bg-gray-50 p-6">
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-2 block text-center text-sm font-medium text-primary">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My awesome playlist"
                className="w-full border-b-2 border-primary/20 bg-transparent pb-2 text-center text-gray-900 placeholder:text-gray-300 focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-center text-sm font-medium text-primary">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's the vibe?"
                className="w-full border-b-2 border-primary/20 bg-transparent pb-2 text-center text-gray-900 placeholder:text-gray-300 focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Participants card */}
        <div className="rounded-2xl bg-gray-50 p-6">
          <p className="mb-4 text-center text-sm font-medium text-primary">
            Participants ({participants.length}/20)
          </p>

          {/* Participant avatars */}
          {participants.length > 0 && (
            <div className="mb-6 flex flex-wrap justify-center gap-4">
              {participants.map((p, i) => {
                const colors = [
                  "border-red-400",
                  "border-cyan-400",
                  "border-purple-400",
                  "border-yellow-400",
                  "border-pink-400",
                  "border-green-400",
                ];
                return (
                  <div key={p.user.id} className="flex flex-col items-center gap-1">
                    <div
                      className={`h-14 w-14 overflow-hidden rounded-full border-[3px] ${colors[i % colors.length]}`}
                    >
                      {p.user.profileImageUrl ? (
                        <img
                          src={p.user.profileImageUrl}
                          alt={p.user.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-primary/10 text-lg font-bold text-primary">
                          {p.user.displayName[0]}
                        </div>
                      )}
                    </div>
                    <span className="max-w-[60px] truncate text-xs text-gray-500">
                      {p.user.displayName.split(" ")[0]}
                    </span>
                  </div>
                );
              })}
              <button
                onClick={handleShareLink}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-primary/30 text-primary transition hover:bg-primary/5"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          )}

          {/* Share actions */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleShareLink}
              disabled={!name.trim()}
              className="flex items-center gap-2 font-medium text-gray-800 disabled:text-gray-300"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Share a link
            </button>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <nav className="mt-auto flex border-t py-3">
        <button className="flex flex-1 flex-col items-center gap-1 text-gray-400">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span className="text-xs">Search</span>
        </button>
        <button className="flex flex-1 flex-col items-center gap-1 text-primary">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" />
          </svg>
          <span className="text-xs font-semibold">Play</span>
        </button>
        <button className="flex flex-1 flex-col items-center gap-1 text-gray-400">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
          <span className="text-xs">Playlists</span>
        </button>
      </nav>
    </div>
  );
}
