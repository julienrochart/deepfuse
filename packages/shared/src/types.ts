export type UserRole = "logout" | "logged_in" | "creator" | "contributor" | "admin";

export interface User {
  id: string;
  spotifyId: string;
  displayName: string;
  profileImageUrl: string | null;
  createdAt: Date;
}

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  creatorId: string;
  spotifyPlaylistId: string | null;
  isActive: boolean;
  shareCode: string;
  createdAt: Date;
}

export interface PlaylistParticipant {
  id: string;
  playlistId: string;
  userId: string;
  role: "creator" | "contributor";
  joinedAt: Date;
}

export interface Track {
  id: string;
  spotifyTrackId: string;
  name: string;
  artist: string;
  albumName: string;
  albumImageUrl: string | null;
  durationMs: number;
  previewUrl: string | null;
}
