"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Stats {
  userCount: number;
  playlistCount: number;
  trackCount: number;
  activePlaylistCount: number;
}

interface AdminUser {
  id: string;
  spotifyId: string;
  displayName: string;
  profileImageUrl: string | null;
  isPremium: boolean;
  createdAt: string;
  _count: { createdPlaylists: number; participations: number };
}

interface AdminPlaylist {
  id: string;
  name: string;
  shareCode: string;
  isActive: boolean;
  createdAt: string;
  creator: { displayName: string };
  _count: { participants: number; tracks: number };
}

interface AccessRequest {
  id: string;
  email: string;
  name: string;
  message: string | null;
  status: string;
  createdAt: string;
}

interface BacklogItem {
  us: string;
  role: string;
  description: string;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  Done: "bg-green-100 text-green-700",
  TODO: "bg-gray-100 text-gray-500",
  "Hors périmètre": "bg-yellow-50 text-yellow-600",
};

type Tab = "requests" | "users" | "playlists" | "backlog";

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [playlists, setPlaylists] = useState<AdminPlaylist[]>([]);
  const [backlog, setBacklog] = useState<BacklogItem[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("requests");
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats", { credentials: "include" }),
      fetch("/api/admin/users", { credentials: "include" }),
      fetch("/api/admin/playlists", { credentials: "include" }),
      fetch("/api/admin/backlog", { credentials: "include" }),
      fetch("/api/admin/access-requests", { credentials: "include" }),
    ])
      .then(async ([statsRes, usersRes, playlistsRes, backlogRes, requestsRes]) => {
        if (statsRes.status === 403 || usersRes.status === 403) {
          setError("Access denied");
          return;
        }
        if (statsRes.status === 401) {
          router.push("/");
          return;
        }
        setStats(await statsRes.json());
        setUsers(await usersRes.json());
        setPlaylists(await playlistsRes.json());
        setBacklog(await backlogRes.json());
        setRequests(await requestsRes.json());
      })
      .catch(() => setError("Failed to load admin data"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold text-red-500">{error}</p>
        <button onClick={() => router.push("/home")} className="font-medium text-primary">
          Go home
        </button>
      </div>
    );
  }

  const doneCount = backlog.filter((b) => b.status === "Done").length;
  const totalCount = backlog.filter((b) => b.status !== "Hors périmètre").length;

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <button onClick={() => router.push("/home")} className="text-sm text-primary">
          Back
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Users", value: stats.userCount },
            { label: "Playlists", value: stats.playlistCount },
            { label: "Active", value: stats.activePlaylistCount },
            { label: "Tracks", value: stats.trackCount },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-gray-50 p-4 text-center">
              <p className="text-2xl font-bold text-primary">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex border-b">
        {(["requests", "backlog", "users", "playlists"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-center text-sm font-semibold capitalize transition ${
              tab === t ? "border-b-2 border-primary text-primary" : "text-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "requests" ? (
        <div className="flex flex-col gap-2">
          {requests.length === 0 && (
            <p className="py-8 text-center text-gray-400">No access requests</p>
          )}
          {requests.map((r) => {
            const statusColor =
              r.status === "approved"
                ? "bg-green-100 text-green-700"
                : r.status === "rejected"
                  ? "bg-red-100 text-red-600"
                  : "bg-yellow-100 text-yellow-700";
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                  <p className="text-xs text-gray-500">{r.email}</p>
                  {r.message && <p className="mt-1 text-xs italic text-gray-400">{r.message}</p>}
                </div>
                <span className="text-xs text-gray-300">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
                <span className={`rounded-lg px-2 py-1 text-xs font-medium ${statusColor}`}>
                  {r.status}
                </span>
                {r.status === "pending" && (
                  <div className="flex gap-1">
                    <button
                      onClick={async () => {
                        await fetch(`/api/admin/access-requests/${r.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ status: "approved" }),
                        });
                        setRequests((prev) =>
                          prev.map((req) =>
                            req.id === r.id ? { ...req, status: "approved" } : req
                          )
                        );
                      }}
                      className="rounded-lg bg-green-500 px-3 py-1 text-xs font-medium text-white hover:bg-green-600"
                    >
                      Approve
                    </button>
                    <button
                      onClick={async () => {
                        await fetch(`/api/admin/access-requests/${r.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ status: "rejected" }),
                        });
                        setRequests((prev) =>
                          prev.map((req) =>
                            req.id === r.id ? { ...req, status: "rejected" } : req
                          )
                        );
                      }}
                      className="rounded-lg bg-red-400 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : tab === "backlog" ? (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {doneCount}/{totalCount} completed
            </p>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-green-400 transition-all"
                style={{ width: `${(doneCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {backlog.map((item) => {
              const colorClass =
                STATUS_COLORS[item.status] ||
                (item.status.startsWith("Partiel")
                  ? "bg-blue-50 text-blue-600"
                  : "bg-gray-100 text-gray-500");
              return (
                <div
                  key={item.us}
                  className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-2.5"
                >
                  <span className="w-8 text-xs font-bold text-gray-300">{item.us}</span>
                  <span className="w-24 text-xs text-gray-400">{item.role}</span>
                  <p className="min-w-0 flex-1 truncate text-sm text-gray-900">
                    {item.description}
                  </p>
                  <span className={`rounded-lg px-2 py-1 text-xs font-medium ${colorClass}`}>
                    {item.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : tab === "users" ? (
        <div className="flex flex-col gap-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
              <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-gray-200">
                {u.profileImageUrl ? (
                  <img
                    src={u.profileImageUrl}
                    alt={u.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold text-gray-500">
                    {u.displayName[0]}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{u.displayName}</p>
                <p className="text-xs text-gray-400">
                  {u.isPremium ? "Premium" : "Free"} · {u._count.createdPlaylists} playlists ·{" "}
                  {u._count.participations} participations
                </p>
              </div>
              <span className="text-xs text-gray-300">
                {new Date(u.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
          {users.length === 0 && <p className="py-8 text-center text-gray-400">No users</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              onClick={() => router.push(`/playlist/${pl.shareCode}`)}
              className="flex cursor-pointer items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 transition hover:bg-gray-100"
            >
              <div
                className={`h-3 w-3 flex-shrink-0 rounded-full ${pl.isActive ? "bg-green-400" : "bg-red-400"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{pl.name}</p>
                <p className="text-xs text-gray-400">
                  by {pl.creator.displayName} · {pl._count.participants} participants ·{" "}
                  {pl._count.tracks} tracks
                </p>
              </div>
              <span className="text-xs text-gray-300">
                {new Date(pl.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
          {playlists.length === 0 && <p className="py-8 text-center text-gray-400">No playlists</p>}
        </div>
      )}
    </div>
  );
}
