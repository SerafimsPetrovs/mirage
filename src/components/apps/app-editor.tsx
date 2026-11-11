"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { btn, inputCls } from "@/components/ui/button";
import { Uploader } from "@/components/studio/uploader";
import { deleteAppAction, saveAppAction } from "@/app/actions/apps";
import { AppIcon } from "./app-icon";

export type AppValue = {
  id?: string;
  slug: string;
  name: string;
  taglineRu: string;
  taglineEn: string;
  descriptionRu: string;
  descriptionEn: string;
  category: string;
  hue: number;
  priceCoins: number;
  winFile: string;
  macFile: string;
  webUrl: string;
  requirements: string;
  featured: boolean;
  active: boolean;
};

const EMPTY: AppValue = { slug: "", name: "", taglineRu: "", taglineEn: "", descriptionRu: "", descriptionEn: "", category: "TOOLS", hue: 260, priceCoins: 0, winFile: "", macFile: "", webUrl: "", requirements: "", featured: false, active: true };
const CATS = ["IMAGE", "VIDEO", "VOICE", "MUSIC", "TEXT", "TOOLS"];

export function AppEditor({ initial }: { initial?: AppValue }) {
  const { t } = useI18n();
  const a = t.v3.apps;
  const m = a.admin;
  const toast = useToast();
  const router = useRouter();
  const [v, setV] = useState<AppValue>(initial ?? EMPTY);
  const [pending, start] = useTransition();
  const set = <K extends keyof AppValue>(k: K, val: AppValue[K]) => setV((x) => ({ ...x, [k]: val }));
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await saveAppAction(v);
      if (r.ok) {
        toast(m.saved, "ok");
        if (!initial) setV(EMPTY);
        router.refresh();
      } else toast(t.v3.control.errors[r.error] ?? t.common.error, "error");
    });
  };
  const text = (k: keyof AppValue, label: string, area = false) => (
    <label className={"block " + (area ? "md:col-span-2" : "")}>
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      {area ? (
        <textarea value={String(v[k])} onChange={(e) => set(k, e.target.value as never)} rows={3} className={inputCls + " h-auto py-2"} />
      ) : (
        <input value={String(v[k])} onChange={(e) => set(k, e.target.value as never)} className={inputCls} />
      )}
    </label>
  );
  return (
    <form onSubmit={save} className="grid gap-4 rounded-3xl bg-surface p-5 ring-1 ring-line md:grid-cols-2 md:p-6">
      <div className="flex items-center gap-4 md:col-span-2">
        <AppIcon name={v.name || "?"} hue={v.hue} category={v.category} size={56} />
        <input type="range" min={0} max={359} value={v.hue} onChange={(e) => set("hue", Number(e.target.value))} aria-label="hue" className="flex-1" />
      </div>
      {text("name", m.name)}
      {text("slug", m.slug)}
      {text("taglineRu", m.taglineRu)}
      {text("taglineEn", m.taglineEn)}
      {text("descriptionRu", m.descriptionRu, true)}
      {text("descriptionEn", m.descriptionEn, true)}
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{m.category}</span>
        <select value={v.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
          {CATS.map((c) => (
            <option key={c} value={c}>
              {a.categories[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{m.price}</span>
        <input type="number" min={0} max={100000} value={v.priceCoins} onChange={(e) => set("priceCoins", Math.max(0, Number(e.target.value) || 0))} className={inputCls} />
      </label>
      {text("requirements", m.requirements)}
      {text("webUrl", m.webUrl)}
      <div>
        <span className="mb-1.5 block text-sm text-muted">{m.winFile}</span>
        {v.winFile && <p className="mb-2 truncate font-mono text-xs text-ok">{v.winFile}</p>}
        <Uploader kind="installer" accept=".exe,.msi,.zip" label={m.winFile} aspect="aspect-[5/2]" onDone={(ref) => set("winFile", ref)} />
      </div>
      <div>
        <span className="mb-1.5 block text-sm text-muted">{m.macFile}</span>
        {v.macFile && <p className="mb-2 truncate font-mono text-xs text-ok">{v.macFile}</p>}
        <Uploader kind="installer" accept=".dmg,.zip" label={m.macFile} aspect="aspect-[5/2]" onDone={(ref) => set("macFile", ref)} />
      </div>
      <div className="flex flex-wrap items-center gap-5 md:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.featured} onChange={(e) => set("featured", e.target.checked)} /> {m.featured}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.active} onChange={(e) => set("active", e.target.checked)} /> {m.active}
        </label>
        <div className="ml-auto flex gap-2">
          {initial?.id && (
            <button type="button" disabled={pending} onClick={() => start(async () => (await deleteAppAction(initial.id!), router.refresh()))} className={btn("ghost", "md")}>
              {m.delete}
            </button>
          )}
          <button disabled={pending || v.name.trim().length < 2 || !/^[a-z0-9-]{2,40}$/.test(v.slug)} className={btn("primary", "md")}>
            {m.save}
          </button>
        </div>
      </div>
    </form>
  );
}
