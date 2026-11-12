import { describe, expect, it } from "vitest";
import { ACT_MS, ACTS, BUDDIES, CHAOS_ACTS, OUTFITS, itemDef, outfitDef, parseOutfit, pickAct, pickFresh, pickLine, reactionEvent, sanitizeLook, slotEvent } from "./buddy-catalog";
import { buddyRu } from "@/i18n/buddy.ru";
import { buddyEn } from "@/i18n/buddy.en";

const slot = (kind: string, tags: string[] = [], clipKind: string | null = null) => ({ kind, clipKind, info: { tags } });

describe("buddy catalog", () => {
  it("has unique ids across buddies and outfits, and sane prices", () => {
    const ids = [...BUDDIES.map((b) => b.id), ...OUTFITS.map((o) => o.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      const d = itemDef(id)!;
      expect(d.cur === "free" || d.cur === "reward" ? d.price === 0 : d.price > 0).toBe(true);
    }
  });

  it("parses stored outfits defensively", () => {
    expect(parseOutfit("not json")).toEqual({});
    expect(parseOutfit('{"hat":"crown","face":"crown","neck":42,"x":"y"}')).toEqual({ hat: "crown" });
    expect(parseOutfit(null)).toEqual({});
  });

  it("sanitizes a look against what is owned", () => {
    expect(sanitizeLook(new Set(), "blip", { hat: "party" })).toEqual({ buddy: "blip", outfit: { hat: "party" } });
    expect(sanitizeLook(new Set(), "goose", {})).toBeNull();
    expect(sanitizeLook(new Set(["goose"]), "goose", { hat: "crown" })).toBeNull();
    expect(sanitizeLook(new Set(), "__proto__", {})).toBeNull();
  });

  it("maps programmes and reactions to events", () => {
    expect(slotEvent(slot("NEWS"), "ABSURD")).toBe("news");
    expect(slotEvent(slot("BREAK"), "ABSURD")).toBe("ads");
    expect(slotEvent(slot("CLIP", [], "AD"), "ABSURD")).toBe("ads");
    expect(slotEvent(slot("CLIP", ["horror"]), "CHILL")).toBe("horror");
    expect(slotEvent(slot("CLIP", ["comedy"]), "DARK")).toBe("comedy");
    expect(slotEvent(slot("CLIP", [], "MUSIC"), "CHILL")).toBe("music");
    expect(slotEvent(slot("EPISODE"), "CHILL")).toBe("show");
    expect(reactionEvent("😂")).toBe("laugh");
    expect(reactionEvent("👀")).toBeNull();
  });

  it("does not repeat the last line", () => {
    expect(pickLine(["a", "b"], "a", () => 0)).toBe("b");
    expect(pickLine(["a"], "a")).toBe("a");
    expect(pickLine([], null)).toBe("");
  });

  it("every buddy has lines for every event in both languages", () => {
    for (const dict of [buddyRu, buddyEn]) {
      for (const b of BUDDIES) {
        const lines = dict.lines[b.id];
        for (const ev of Object.keys(buddyRu.lines.blip) as (keyof typeof lines)[]) expect(lines[ev].length).toBeGreaterThan(0);
      }
      for (const o of OUTFITS) expect(dict.outfitNames[o.id]).toBeTruthy();
    }
  });
});

describe("pickFresh / acts", () => {
  it("does not repeat recent lines while fresh ones remain", () => {
    const lines = ["a", "b", "c", "d"];
    const said: string[] = [];
    for (let i = 0; i < 4; i++) said.push(pickFresh(lines, said));
    expect(new Set(said).size).toBe(4);
  });
  it("falls back to anything but the last line once the pool is used up", () => {
    expect(pickFresh(["a", "b"], ["a", "b"], () => 0)).toBe("a");
    expect(pickFresh(["a", "b"], ["b", "a"], () => 0)).toBe("b");
    expect(pickFresh([], [])).toBe("");
  });
  it("only does chaos acts in 67 mode", () => {
    for (let i = 0; i < 50; i++) expect((ACTS as readonly string[]).includes(pickAct(false, "blip"))).toBe(true);
    const seen = new Set(Array.from({ length: 200 }, () => pickAct(true, "kex")));
    expect([...seen].some((a) => (CHAOS_ACTS as readonly string[]).includes(a))).toBe(true);
  });
  it("every act has a duration", () => {
    for (const a of [...ACTS, ...CHAOS_ACTS]) expect(ACT_MS[a]).toBeGreaterThan(0);
  });
  it("new film-reference outfits are sellable and slotted", () => {
    for (const id of ["fedora", "wizard", "headband", "hockeymask", "matrix", "yellowsuit", "cape", "flugegeheimen", "sixseven"]) {
      const d = outfitDef(id);
      expect(d && d.cur !== "reward" && d.price > 0).toBe(true);
    }
    expect(outfitDef("sixseven")?.price).toBe(67);
  });
});
