import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./auth", () => ({ getCurrentUser: async () => null }));

describe("Top-10 chart merge", () => {
  it("puts pinned series at their place and fills the rest by views", async () => {
    const { mergeChart } = await import("./catalog");
    const byViews = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
    const pinned = [{ id: "x", rank: 2 }, { id: "c", rank: 1 }];
    expect(mergeChart(pinned, byViews, 5).map((s) => s.id)).toEqual(["c", "x", "a", "b", "d"]);
  });
  it("two series on the same place: the second takes the next free slot", async () => {
    const { mergeChart } = await import("./catalog");
    const out = mergeChart([{ id: "x", rank: 3 }, { id: "y", rank: 3 }], [{ id: "a" }, { id: "b" }, { id: "c" }], 5);
    expect(out.map((s) => s.id)).toEqual(["a", "b", "x", "y", "c"]);
  });
});
