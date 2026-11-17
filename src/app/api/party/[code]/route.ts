import { getCurrentUser } from "@/lib/auth";
import { PartyError, partyState } from "@/lib/party";

/** Room state, polled every ~2 s by every member (also their "I am here" heartbeat). `?since=<ms>` = only newer events. */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const since = Number(new URL(req.url).searchParams.get("since")) || 0;
  try {
    return Response.json(await partyState(await getCurrentUser(), code, since), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const status = e instanceof PartyError ? (e.code === "AUTH" ? 401 : e.code === "ENDED" ? 410 : 403) : 500;
    if (status === 500) console.error("[party state]", e);
    return Response.json({ error: e instanceof PartyError ? e.code : "unknown" }, { status });
  }
}
