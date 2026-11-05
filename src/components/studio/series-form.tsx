"use client";
import { useActionState, useEffect, useState } from "react";
import clsx from "clsx";
import { btn, inputCls, labelCls, textareaCls } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { saveSeriesAction } from "@/app/actions/studio";
import type { FormState } from "@/app/actions/auth";
import { Uploader } from "./uploader";

const GENRES = ["romance", "drama", "revenge", "ceo", "fantasy", "scifi", "thriller", "comedy", "historical", "mystery", "horror", "anime"] as const;
const MOODS = ["revenge", "butterflies", "cry", "thrill", "laugh", "wonder"] as const;

export type SeriesFormValues = {
  id?: string;
  titleRu: string;
  titleEn: string;
  taglineRu: string;
  taglineEn: string;
  descriptionRu: string;
  descriptionEn: string;
  orientation: "VERTICAL" | "HORIZONTAL";
  genres: string[];
  moods: string[];
  aiModels: string;
  promptNotesRu: string;
  promptNotesEn: string;
  ageRating: string;
  isAdult: boolean;
  adultLocked?: boolean;
  freeEpisodes: number;
  defaultCoinPrice: number;
  hue: number;
  posterUrl: string;
  backdropUrl: string;
  posterPreview: string | null;
  backdropPreview: string | null;
};

export const emptySeries: SeriesFormValues = {
  titleRu: "", titleEn: "", taglineRu: "", taglineEn: "", descriptionRu: "", descriptionEn: "",
  orientation: "VERTICAL", genres: [], moods: [], aiModels: "", promptNotesRu: "", promptNotesEn: "",
  ageRating: "16+", isAdult: false, freeEpisodes: 5, defaultCoinPrice: 30, hue: 330, posterUrl: "", backdropUrl: "",
  posterPreview: null, backdropPreview: null,
};

function Toggle({ name, value, checked, label }: { name: string; value: string; checked: boolean; label: string }) {
  const [on, setOn] = useState(checked);
  return (
    <label className={clsx("cursor-pointer rounded-full px-3.5 py-1.5 text-sm ring-1 transition select-none", on ? "bg-white text-black ring-white" : "bg-surface-2 ring-line hover:ring-white/25")}>
      <input type="checkbox" name={name} value={value} defaultChecked={checked} onChange={(e) => setOn(e.target.checked)} className="sr-only" />
      {label}
    </label>
  );
}

export function SeriesForm({ initial }: { initial: SeriesFormValues }) {
  const { t } = useI18n();
  const toast = useToast();
  const [state, action, pending] = useActionState<FormState, FormData>(saveSeriesAction, undefined);
  const [poster, setPoster] = useState(initial.posterUrl);
  const [backdrop, setBackdrop] = useState(initial.backdropUrl);
  const [hue, setHue] = useState(initial.hue);
  useEffect(() => {
    if (state?.ok) toast(t.common.saved);
    if (state?.error) toast(state.error, "error");
  }, [state, toast, t.common.saved]);
  const f = t.studio.form;

  return (
    <form action={action} className="space-y-8">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="posterUrl" value={poster} />
      <input type="hidden" name="backdropUrl" value={backdrop} />

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <div className="space-y-4">
          <Uploader kind="image" accept="image/*" label={f.poster} preview={initial.posterPreview} onDone={setPoster} />
          <Uploader kind="image" accept="image/*" label={f.backdrop} preview={initial.backdropPreview} onDone={setBackdrop} aspect="aspect-video" />
          <p className="text-xs text-muted">{f.posterHint}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="titleRu">{f.titleRu}</label>
            <input id="titleRu" name="titleRu" defaultValue={initial.titleRu} required maxLength={120} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="titleEn">{f.titleEn}</label>
            <input id="titleEn" name="titleEn" defaultValue={initial.titleEn} maxLength={120} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="taglineRu">{f.taglineRu}</label>
            <input id="taglineRu" name="taglineRu" defaultValue={initial.taglineRu} maxLength={200} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="taglineEn">{f.taglineEn}</label>
            <input id="taglineEn" name="taglineEn" defaultValue={initial.taglineEn} maxLength={200} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="descriptionRu">{f.descriptionRu}</label>
            <textarea id="descriptionRu" name="descriptionRu" defaultValue={initial.descriptionRu} required rows={4} maxLength={4000} className={textareaCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="descriptionEn">{f.descriptionEn}</label>
            <textarea id="descriptionEn" name="descriptionEn" defaultValue={initial.descriptionEn} rows={4} maxLength={4000} className={textareaCls} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelCls} htmlFor="orientation">{f.orientation}</label>
          <select id="orientation" name="orientation" defaultValue={initial.orientation} className={inputCls}>
            <option value="VERTICAL">{t.common.vertical} 9:16</option>
            <option value="HORIZONTAL">{t.common.horizontal} 16:9</option>
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="ageRating">{f.ageRating}</label>
          <select id="ageRating" name="ageRating" defaultValue={initial.ageRating} className={inputCls}>
            {["0+", "6+", "12+", "16+", "18+"].map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="freeEpisodes">{f.freeEpisodes}</label>
          <input id="freeEpisodes" name="freeEpisodes" type="number" min={0} max={50} defaultValue={initial.freeEpisodes} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="defaultCoinPrice">{f.defaultCoinPrice}</label>
          <input id="defaultCoinPrice" name="defaultCoinPrice" type="number" min={1} max={500} defaultValue={initial.defaultCoinPrice} className={inputCls} />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface-2 p-4 ring-1 ring-line has-[:checked]:ring-accent/50">
        <input type="checkbox" name="isAdult" defaultChecked={initial.isAdult || initial.adultLocked} disabled={initial.adultLocked} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" />
        {initial.adultLocked && <input type="hidden" name="isAdult" value="on" />}
        <span>
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-xs font-bold text-accent">18+</span> {t.adult.studioLabel}
          </span>
          <span className="mt-1 block text-xs text-muted">{initial.adultLocked ? t.adult.lockedHint : t.adult.studioHint}</span>
        </span>
      </label>

      <div>
        <p className={labelCls}>{f.genres}</p>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => <Toggle key={g} name="genres" value={g} checked={initial.genres.includes(g)} label={t.genres[g]} />)}
        </div>
      </div>
      <div>
        <p className={labelCls}>{f.moods}</p>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => <Toggle key={m} name="moods" value={m} checked={initial.moods.includes(m)} label={t.moods[m]} />)}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="aiModels">{f.aiModels}</label>
          <input id="aiModels" name="aiModels" defaultValue={initial.aiModels} placeholder="Sora 2, Kling 2.5, Suno v5" maxLength={300} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="promptNotesRu">{f.promptNotesRu}</label>
          <textarea id="promptNotesRu" name="promptNotesRu" defaultValue={initial.promptNotesRu} rows={4} maxLength={3000} className={textareaCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="promptNotesEn">{f.promptNotesEn}</label>
          <textarea id="promptNotesEn" name="promptNotesEn" defaultValue={initial.promptNotesEn} rows={4} maxLength={3000} className={textareaCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="hue">{f.hue}</label>
          <div className="flex items-center gap-4">
            <input id="hue" name="hue" type="range" min={0} max={360} value={hue} onChange={(e) => setHue(Number(e.target.value))} className="flex-1 accent-[var(--accent)]" />
            <span className="h-9 w-9 rounded-full ring-1 ring-line" style={{ background: `hsl(${hue} 85% 55%)` }} />
          </div>
        </div>
      </div>

      <button disabled={pending} className={btn("primary", "lg")}>{pending ? t.common.loading : t.common.save}</button>
    </form>
  );
}
