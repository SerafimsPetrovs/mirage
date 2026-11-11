"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createTask, deleteTask, HubError, redeemInvite, setEpisodeRelease, updateTask } from "@/lib/studio-hub";

type R = { ok: true } | { ok: false; error: HubError["code"] | "auth" | "invalid" | "unknown" };

async function creator() {
  const u = await getCurrentUser();
  if (!u || u.kidsMode || (u.role !== "CREATOR" && u.role !== "ADMIN")) throw new HubError("NOT_FOUND");
  return u;
}

function fail(e: unknown): R {
  if (e instanceof HubError) return { ok: false, error: e.code };
  if (e instanceof z.ZodError) return { ok: false, error: "invalid" };
  console.error("[studio hub]", e);
  return { ok: false, error: "unknown" };
}

/** Release scheduler: `at` = ISO time (null = release now). */
export async function setReleaseAction(episodeId: string, at: string | null): Promise<R> {
  try {
    const u = await creator();
    await setEpisodeRelease(u, z.string().max(64).parse(episodeId), at ? new Date(z.string().max(40).parse(at)) : null);
    revalidatePath("/studio/planner");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const taskSchema = z.object({
  title: z.string().max(200),
  notes: z.string().max(4000).optional(),
  seriesId: z.string().max(64).nullable().optional(),
  dueAt: z.string().max(40).nullable().optional(),
  checklist: z.array(z.string().max(80)).max(20).optional(),
});

export async function createTaskAction(input: unknown): Promise<R> {
  try {
    const u = await creator();
    const d = taskSchema.parse(input);
    await createTask(u, { ...d, dueAt: d.dueAt ? new Date(d.dueAt) : null });
    revalidatePath("/studio/planner");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const patchSchema = z.object({
  status: z.enum(["TODO", "DOING", "DONE"]).optional(),
  checklist: z.array(z.object({ t: z.string().max(80), done: z.boolean() })).max(20).optional(),
  notes: z.string().max(4000).optional(),
  title: z.string().max(200).optional(),
});

export async function updateTaskAction(id: string, patch: unknown): Promise<R> {
  try {
    const u = await creator();
    await updateTask(u, z.string().max(64).parse(id), patchSchema.parse(patch));
    revalidatePath("/studio/planner");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTaskAction(id: string): Promise<R> {
  try {
    const u = await creator();
    await deleteTask(u, z.string().max(64).parse(id));
    revalidatePath("/studio/planner");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** A viewer enters a creator's invite code and becomes a creator (rate-limited against guessing). */
export async function redeemInviteAction(code: string): Promise<R> {
  const u = await getCurrentUser();
  if (!u || u.kidsMode) return { ok: false, error: "auth" };
  if (!rateLimit(`invite:${u.id}`, 8, 60 * 60_000).allowed) return { ok: false, error: "LIMIT" };
  try {
    await redeemInvite(u, z.string().max(40).parse(code));
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
