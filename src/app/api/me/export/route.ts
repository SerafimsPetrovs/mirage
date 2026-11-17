import { getCurrentUser } from "@/lib/auth";
import { exportUserData } from "@/lib/data-export";
import { rateLimit } from "@/lib/rate-limit";

/** "Download my data" (GDPR art. 15/20): the signed-in user's own data as a JSON file. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.kidsMode) return new Response("Unauthorized", { status: 401 });
  if (!rateLimit(`export:${user.id}`, 5, 60 * 60_000).allowed) return new Response("Too many requests", { status: 429 });
  const data = await exportUserData(user.id);
  if (!data) return new Response("Not found", { status: 404 });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mirage-my-data-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
