import { forbidInKidsMode, requireRole } from "@/lib/auth";
import { hotBountyCount } from "@/lib/tv-control";
import { StudioNav } from "@/components/studio-hub/studio-nav";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  await forbidInKidsMode();
  await requireRole(["CREATOR", "ADMIN"], "/studio");
  const hot = await hotBountyCount().catch(() => 0);
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-[calc(var(--header-h)+24px)] md:px-10">
      <StudioNav hot={hot} />
      {children}
    </div>
  );
}
