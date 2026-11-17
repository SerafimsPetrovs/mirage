"use server";
import { getCurrentUser } from "@/lib/auth";
import { createParty, partyAction, PartyError, type PartyOp } from "@/lib/party";

export type PartyResult<T = object> = ({ ok: true } & T) | { ok: false; error: PartyError["code"] | "unknown" };

function fail(e: unknown): { ok: false; error: PartyError["code"] | "unknown" } {
  if (e instanceof PartyError) return { ok: false, error: e.code };
  console.error("[party action]", e);
  return { ok: false, error: "unknown" };
}

export async function createPartyAction(input: { channelSlug?: string; episodeId?: string; title?: string }): Promise<PartyResult<{ code: string }>> {
  try {
    const p = await createParty(await getCurrentUser(), {
      channelSlug: typeof input?.channelSlug === "string" ? input.channelSlug.slice(0, 60) : null,
      episodeId: typeof input?.episodeId === "string" ? input.episodeId.slice(0, 64) : null,
      title: typeof input?.title === "string" ? input.title : "",
    });
    return { ok: true, code: p.code };
  } catch (e) {
    return fail(e);
  }
}

/** One entry point for everything that happens inside a room; partyAction validates each op. */
export async function partyOpAction(code: string, op: PartyOp): Promise<PartyResult> {
  if (typeof code !== "string" || !op || typeof op !== "object" || typeof (op as { op?: unknown }).op !== "string") return { ok: false, error: "INVALID" };
  try {
    await partyAction(await getCurrentUser(), code, op);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
