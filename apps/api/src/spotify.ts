import { prisma } from "@deepfuse/db";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

export async function getValidToken(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.tokenExpiresAt && user.tokenExpiresAt > new Date()) {
    return user.spotifyToken!;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: user.spotifyRefresh!,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("Spotify token refresh error:", res.status, errBody);
    throw new Error(`Failed to refresh Spotify token: ${res.status} ${errBody}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  await prisma.user.update({
    where: { id: userId },
    data: {
      spotifyToken: data.access_token,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
      ...(data.refresh_token ? { spotifyRefresh: data.refresh_token } : {}),
    },
  });

  return data.access_token;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
  preview_url: string | null;
  uri: string;
}

export async function getSavedTracks(userId: string, limit = 50): Promise<SpotifyTrack[]> {
  const token = await getValidToken(userId);
  const tracks: SpotifyTrack[] = [];
  let url: string | null = `${API_BASE}/me/tracks?limit=${Math.min(limit, 50)}`;

  while (url && tracks.length < limit) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) break;

    const data = (await res.json()) as {
      items: { track: SpotifyTrack }[];
      next: string | null;
    };

    tracks.push(...data.items.map((i) => i.track));
    url = tracks.length < limit ? data.next : null;
  }

  return tracks.slice(0, limit);
}

export async function createSpotifyPlaylist(
  userId: string,
  name: string,
  description?: string
): Promise<string> {
  const token = await getValidToken(userId);

  const res = await fetch(`${API_BASE}/me/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      description: description || "Created with DeepFuse",
      public: false,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("Spotify create playlist error:", res.status, errBody);
    throw new Error(`Failed to create Spotify playlist: ${res.status} ${errBody}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function addTracksToSpotifyPlaylist(
  userId: string,
  playlistId: string,
  trackUris: string[]
): Promise<void> {
  const token = await getValidToken(userId);

  // Use PUT /items to replace all tracks (max 100 per request)
  for (let i = 0; i < trackUris.length; i += 100) {
    const batch = trackUris.slice(i, i + 100);
    const isFirst = i === 0;
    const res = await fetch(`${API_BASE}/playlists/${playlistId}/items`, {
      method: isFirst ? "PUT" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: batch }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Spotify add tracks error:", res.status, errBody);
      throw new Error(`Failed to add tracks: ${res.status} ${errBody}`);
    }
  }
}

export interface AudioFeatures {
  id: string;
  energy: number;
  danceability: number;
  valence: number;
  tempo: number;
  acousticness: number;
  instrumentalness: number;
}

export async function getAudioFeatures(
  userId: string,
  trackIds: string[]
): Promise<Map<string, AudioFeatures>> {
  const token = await getValidToken(userId);
  const features = new Map<string, AudioFeatures>();

  for (let i = 0; i < trackIds.length; i += 100) {
    const batch = trackIds.slice(i, i + 100);
    const res = await fetch(`${API_BASE}/audio-features?ids=${batch.join(",")}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) continue;
    const data = (await res.json()) as { audio_features: (AudioFeatures | null)[] };
    for (const af of data.audio_features) {
      if (af) features.set(af.id, af);
    }
  }

  return features;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function smartFuse(
  tracksByUser: Map<string, SpotifyTrack[]>,
  features: Map<string, AudioFeatures>
): SpotifyTrack[] {
  const users = [...tracksByUser.entries()];
  if (users.length === 0) return [];

  const allTracks = users.flatMap(([, tracks]) => tracks);
  const allFeatures = allTracks.map((t) => features.get(t.id)).filter(Boolean) as AudioFeatures[];

  if (allFeatures.length === 0) return fuseTracks(tracksByUser);

  // Group profile: median of each feature across all participants
  const profile = {
    energy: median(allFeatures.map((f) => f.energy)),
    danceability: median(allFeatures.map((f) => f.danceability)),
    valence: median(allFeatures.map((f) => f.valence)),
    tempo: median(allFeatures.map((f) => f.tempo)),
  };

  // Score each track: distance from group profile (lower = better fit)
  function score(trackId: string): number {
    const f = features.get(trackId);
    if (!f) return 1;
    const tempoNorm = Math.abs(f.tempo - profile.tempo) / 200;
    return (
      Math.abs(f.energy - profile.energy) * 0.3 +
      Math.abs(f.danceability - profile.danceability) * 0.3 +
      Math.abs(f.valence - profile.valence) * 0.2 +
      tempoNorm * 0.2
    );
  }

  // Round-robin dedup (fair representation), then sort by compatibility
  const seen = new Set<string>();
  const pool: SpotifyTrack[] = [];
  const maxLen = Math.max(...users.map(([, tracks]) => tracks.length));

  for (let i = 0; i < maxLen; i++) {
    for (const [, tracks] of users) {
      if (i < tracks.length) {
        const track = tracks[i];
        if (!seen.has(track.id)) {
          seen.add(track.id);
          pool.push(track);
        }
      }
    }
  }

  // Filter: drop tracks that are too far from group profile (score > 0.4)
  const threshold = 0.4;
  const minTracks = Math.max(3, Math.floor(pool.length * 0.5));
  let filtered = pool.filter((t) => score(t.id) <= threshold);
  if (filtered.length < minTracks) {
    filtered = [...pool].sort((a, b) => score(a.id) - score(b.id)).slice(0, minTracks);
  }

  // Sort for smooth transitions: start from the most "average" track,
  // then greedily pick the nearest neighbor by energy+tempo
  const sorted: SpotifyTrack[] = [];
  const remaining = new Set(filtered.map((_, i) => i));

  // Start with the track closest to group profile
  let bestIdx = 0;
  let bestScore = Infinity;
  filtered.forEach((t, i) => {
    const s = score(t.id);
    if (s < bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  });

  sorted.push(filtered[bestIdx]);
  remaining.delete(bestIdx);

  while (remaining.size > 0) {
    const last = sorted[sorted.length - 1];
    const lastF = features.get(last.id);

    let nearestIdx = -1;
    let nearestDist = Infinity;

    for (const idx of remaining) {
      const f = features.get(filtered[idx].id);
      if (!lastF || !f) {
        if (nearestIdx === -1) nearestIdx = idx;
        continue;
      }
      const dist =
        Math.abs(f.energy - lastF.energy) * 0.4 +
        (Math.abs(f.tempo - lastF.tempo) / 200) * 0.3 +
        Math.abs(f.valence - lastF.valence) * 0.3;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = idx;
      }
    }

    if (nearestIdx >= 0) {
      sorted.push(filtered[nearestIdx]);
      remaining.delete(nearestIdx);
    }
  }

  return sorted;
}

export function fuseTracks(tracksByUser: Map<string, SpotifyTrack[]>): SpotifyTrack[] {
  const seen = new Set<string>();
  const fused: SpotifyTrack[] = [];
  const users = [...tracksByUser.entries()];

  if (users.length === 0) return [];

  const maxLen = Math.max(...users.map(([, tracks]) => tracks.length));

  // Round-robin interleave: take one track from each user in turn
  for (let i = 0; i < maxLen; i++) {
    for (const [, tracks] of users) {
      if (i < tracks.length) {
        const track = tracks[i];
        if (!seen.has(track.id)) {
          seen.add(track.id);
          fused.push(track);
        }
      }
    }
  }

  return fused;
}
