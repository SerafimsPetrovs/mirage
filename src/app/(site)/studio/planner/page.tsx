import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { listTasks, parseChecklist, releaseCalendar } from "@/lib/studio-hub";
import { ReleaseCalendar, TaskBoard } from "@/components/studio-hub/planner";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.v3.studio.planner.title };
}

/** Release scheduler (episode release dates) + the creator's production task tracker. */
export default async function PlannerPage() {
  const [{ t, locale }, user] = await Promise.all([getI18n(), requireUser("/studio/planner")]);
  const [calendar, tasks] = await Promise.all([releaseCalendar(user, locale), listTasks(user)]);
  // eslint-disable-next-line react-hooks/purity -- server component: the request time is the reference point
  const now = Date.now();
  return (
    <div className="space-y-12">
      <header>
        <h1 className="font-display text-3xl font-bold">{t.v3.studio.planner.title}</h1>
        <p className="mt-2 text-muted">{t.v3.studio.planner.sub}</p>
      </header>
      <ReleaseCalendar series={calendar} now={now} />
      <TaskBoard
        series={calendar.map((s) => ({ id: s.id, title: s.title }))}
        tasks={tasks.map((x) => ({
          id: x.id,
          title: x.title,
          notes: x.notes,
          status: x.status,
          dueAt: x.dueAt?.getTime() ?? null,
          series: x.series ? pick(x.series, "title", locale) : null,
          checklist: parseChecklist(x.checklist),
        }))}
      />
    </div>
  );
}
