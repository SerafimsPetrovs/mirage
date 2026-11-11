import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { TvSubnav } from "@/components/tv/tv-subnav";

export default async function AdminTvLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  const tabs = t.tv.adm2.tabs;
  const [orders, clips] = await Promise.all([prisma.tvOrder.count({ where: { status: "REVIEW" } }), prisma.tvClip.count({ where: { status: "PENDING" } })]);
  return (
    <>
      <TvSubnav
        items={[
          { href: "/admin/tv", label: tabs.overview },
          { href: "/admin/tv/moderation", label: tabs.moderation, badge: orders + clips },
          { href: "/admin/tv/channels", label: tabs.channels },
          { href: "/admin/tv/schedule", label: tabs.schedule },
          { href: "/admin/tv/clips", label: tabs.clips },
          { href: "/admin/tv/factory", label: tabs.factory },
        ]}
      />
      {children}
    </>
  );
}
