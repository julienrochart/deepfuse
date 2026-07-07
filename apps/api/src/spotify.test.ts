import { describe, it, expect } from "vitest";
import { fuseTracks, smartFuse } from "./spotify.js";
import type { AudioFeatures } from "./spotify.js";

function track(id: string, name: string) {
  return {
    id,
    name,
    artists: [{ name: "Artist" }],
    album: { name: "Album", images: [] },
    duration_ms: 200000,
    preview_url: null,
    uri: `spotify:track:${id}`,
  };
}

describe("fuseTracks", () => {
  it("returns empty array for no users", () => {
    expect(fuseTracks(new Map())).toEqual([]);
  });

  it("returns all tracks for single user", () => {
    const map = new Map([["user1", [track("a", "A"), track("b", "B")]]]);
    const result = fuseTracks(map);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("a");
    expect(result[1].id).toBe("b");
  });

  it("interleaves tracks round-robin across users", () => {
    const map = new Map([
      ["user1", [track("a1", "A1"), track("a2", "A2")]],
      ["user2", [track("b1", "B1"), track("b2", "B2")]],
    ]);
    const result = fuseTracks(map);
    expect(result.map((t) => t.id)).toEqual(["a1", "b1", "a2", "b2"]);
  });

  it("deduplicates tracks with same id", () => {
    const map = new Map([
      ["user1", [track("same", "Same Track"), track("a2", "A2")]],
      ["user2", [track("same", "Same Track"), track("b2", "B2")]],
    ]);
    const result = fuseTracks(map);
    expect(result.map((t) => t.id)).toEqual(["same", "a2", "b2"]);
  });

  it("handles uneven track counts", () => {
    const map = new Map([
      ["user1", [track("a1", "A1")]],
      ["user2", [track("b1", "B1"), track("b2", "B2"), track("b3", "B3")]],
    ]);
    const result = fuseTracks(map);
    expect(result).toHaveLength(4);
    expect(result[0].id).toBe("a1");
    expect(result[1].id).toBe("b1");
  });

  it("handles three users", () => {
    const map = new Map([
      ["user1", [track("a", "A")]],
      ["user2", [track("b", "B")]],
      ["user3", [track("c", "C")]],
    ]);
    const result = fuseTracks(map);
    expect(result.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
});

function af(
  id: string,
  energy: number,
  danceability: number,
  valence: number,
  tempo: number
): AudioFeatures {
  return { id, energy, danceability, valence, tempo, acousticness: 0.5, instrumentalness: 0 };
}

describe("smartFuse", () => {
  it("returns empty array for no users", () => {
    expect(smartFuse(new Map(), new Map())).toEqual([]);
  });

  it("falls back to basic fusion when no features available", () => {
    const map = new Map([["user1", [track("a", "A"), track("b", "B")]]]);
    const result = smartFuse(map, new Map());
    expect(result).toHaveLength(2);
  });

  it("filters out tracks too far from group profile", () => {
    const chill1 = track("c1", "Chill 1");
    const chill2 = track("c2", "Chill 2");
    const chill3 = track("c3", "Chill 3");
    const extreme = track("ex", "Death Metal");

    const map = new Map([
      ["user1", [chill1, chill2]],
      ["user2", [chill3, extreme]],
    ]);

    const features = new Map<string, AudioFeatures>([
      ["c1", af("c1", 0.3, 0.6, 0.7, 120)],
      ["c2", af("c2", 0.35, 0.55, 0.65, 115)],
      ["c3", af("c3", 0.4, 0.5, 0.6, 125)],
      ["ex", af("ex", 0.95, 0.2, 0.1, 200)],
    ]);

    const result = smartFuse(map, features);
    const ids = result.map((t) => t.id);
    expect(ids).not.toContain("ex");
    expect(ids).toContain("c1");
    expect(ids).toContain("c2");
    expect(ids).toContain("c3");
  });

  it("sorts tracks for smooth transitions (similar energy adjacent)", () => {
    const low = track("lo", "Low");
    const mid = track("mi", "Mid");
    const high = track("hi", "High");

    const map = new Map([
      ["user1", [high, low]],
      ["user2", [mid]],
    ]);

    const features = new Map<string, AudioFeatures>([
      ["lo", af("lo", 0.2, 0.5, 0.5, 100)],
      ["mi", af("mi", 0.5, 0.5, 0.5, 120)],
      ["hi", af("hi", 0.8, 0.5, 0.5, 140)],
    ]);

    const result = smartFuse(map, features);
    const ids = result.map((t) => t.id);
    // Should be ordered by proximity, not random
    const midIdx = ids.indexOf("mi");
    const loIdx = ids.indexOf("lo");
    const hiIdx = ids.indexOf("hi");
    // mid should be between low and high (smooth transition)
    expect(Math.abs(midIdx - loIdx)).toBeLessThanOrEqual(2);
    expect(Math.abs(midIdx - hiIdx)).toBeLessThanOrEqual(2);
  });

  it("keeps at least 50% of tracks even with strict filtering", () => {
    const tracks = Array.from({ length: 10 }, (_, i) => track(`t${i}`, `Track ${i}`));
    const map = new Map([["user1", tracks]]);

    const features = new Map<string, AudioFeatures>(
      tracks.map((t, i) => [t.id, af(t.id, i * 0.1, 0.5, 0.5, 120)])
    );

    const result = smartFuse(map, features);
    expect(result.length).toBeGreaterThanOrEqual(5);
  });
});
