import { describe, it, expect } from "vitest";
import { fuseTracks } from "./spotify.js";

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
