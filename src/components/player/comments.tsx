"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Send, MessageCircle } from "lucide-react";
import { Avatar, VipBadge } from "@/components/ui/misc";
import { useI18n } from "@/i18n/client";
import { addCommentAction, getCommentsAction } from "@/app/actions/library";

type C = Awaited<ReturnType<typeof getCommentsAction>>[number];

function ago(iso: string, locale: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (s < 60) return rtf.format(-Math.round(s), "second");
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  return rtf.format(-Math.round(s / 86400), "day");
}

export function Comments({ episodeId, loggedIn, me, active }: { episodeId: string; loggedIn: boolean; me: { name: string; hue: number } | null; active: boolean }) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<C[] | null>(null);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!active) return;
    let alive = true;
    getCommentsAction(episodeId).then((c) => alive && setItems(c));
    return () => {
      alive = false;
    };
  }, [episodeId, active]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !me) return;
    start(async () => {
      const r = await addCommentAction(episodeId, body);
      if (r.ok) {
        setItems((xs) => [
          { id: r.data!.id, body, createdAt: new Date().toISOString(), user: { name: me.name, hue: me.hue, creator: false, vip: false } },
          ...(xs ?? []),
        ]);
        setText("");
      }
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-[200px] flex-1 space-y-5 pb-4">
        {items === null &&
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-24 rounded" />
                <div className="skeleton h-3 w-3/4 rounded" />
              </div>
            </div>
          ))}
        {items?.length === 0 && (
          <div className="flex flex-col items-center py-10 text-center text-muted">
            <MessageCircle size={28} className="mb-2" />
            {t.player.noComments}
          </div>
        )}
        {items?.map((c) => (
          <div key={c.id} className="animate-fade-up flex gap-3">
            <Avatar name={c.user.name} hue={c.user.hue} size={36} />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="font-semibold">{c.user.name}</span>
                {c.user.vip && <VipBadge />}
                <span className="text-xs text-muted">{ago(c.createdAt, locale)}</span>
              </p>
              <p className="mt-0.5 break-words text-[15px] text-white/85">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 -mx-5 border-t border-line bg-surface px-5 pt-3">
        {loggedIn ? (
          <form onSubmit={submit} className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder={t.player.writeComment}
              className="h-11 flex-1 rounded-full bg-surface-2 px-4 text-[15px] outline-none ring-1 ring-line focus:ring-accent/60"
            />
            <button disabled={pending || !text.trim()} aria-label={t.player.send} className="flex h-11 w-11 items-center justify-center rounded-full bg-accent disabled:opacity-40">
              <Send size={18} />
            </button>
          </form>
        ) : (
          <Link href="/login" className="block rounded-full bg-surface-2 px-4 py-3 text-center text-sm text-muted ring-1 ring-line">
            {t.player.loginToComment}
          </Link>
        )}
      </div>
    </div>
  );
}
