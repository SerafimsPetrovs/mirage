"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Flame, ImagePlus, MessageCircleHeart, Plus, Shirt, Trash2, UserPlus } from "lucide-react";
import { btn, inputCls, labelCls, textareaCls } from "@/components/ui/button";
import { CoinAmount } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { Uploader } from "./uploader";
import {
  addPhotoAction, addSkinAction, deleteCharacterAction, deletePhotoAction, deleteSceneAction, deleteSkinAction, saveCharacterAction, saveSceneAction,
} from "@/app/actions/studio-extras";
import { DEFAULT_PHOTO_PRICE, DEFAULT_SCENE_PRICE, DEFAULT_SKIN_PRICE, RARITIES } from "@/lib/spicy";
import { CharacterAvatar } from "@/components/player/spicy";

type Skin = { id: string; nameRu: string; emoji: string; rarity: string; price: number };
type Scene = { titleRu: string; titleEn: string; price: number; durationSec: number; triggerAtSec: number | null; videoUrl: string };
type Ep = { id: string; number: number; title: string; skins: Skin[]; scene: Scene | null };
type Photo = { id: string; preview: string; captionRu: string; price: number };
export type StudioCharacter = {
  id: string; nameRu: string; nameEn: string; taglineRu: string; taglineEn: string; greetingRu: string; greetingEn: string;
  persona: string; age: number; avatarUrl: string; avatarPreview: string | null; hue: number; photos: Photo[];
};

function useRun() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast(t.common.saved);
        after?.();
        router.refresh();
      } else toast(r.error === "age_18" ? t.studio.adultOnly : r.error === "family" ? t.studio.extrasFamily : (r.error ?? t.common.error), "error");
    });
  return { pending, run };
}

export function ExtrasManager({ seriesId, familySafe, episodes, characters }: { seriesId: string; familySafe: boolean; episodes: Ep[]; characters: StudioCharacter[] }) {
  const { t } = useI18n();
  const [epId, setEpId] = useState(episodes[0]?.id ?? "");
  const ep = episodes.find((e) => e.id === epId);

  if (familySafe) return <p className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-muted">{t.studio.extrasFamily}</p>;

  return (
    <div className="space-y-8">
      {episodes.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <label className={labelCls} htmlFor="extras-ep">{t.studio.episodeExtras}</label>
              <select id="extras-ep" value={epId} onChange={(e) => setEpId(e.target.value)} className={inputCls}>
                {episodes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {t.common.episode} {e.number}{e.title ? ` · ${e.title}` : ""}
                    {e.skins.length || e.scene ? `  (${e.skins.length ? `👗${e.skins.length}` : ""}${e.scene ? " 🔥" : ""})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {ep && (
            <div className="grid gap-4 lg:grid-cols-2" key={ep.id}>
              <SkinsEditor ep={ep} />
              <SceneEditor ep={ep} />
            </div>
          )}
        </div>
      )}
      <CharactersEditor seriesId={seriesId} characters={characters} />
    </div>
  );
}

function SkinsEditor({ ep }: { ep: Ep }) {
  const { t } = useI18n();
  const { pending, run } = useRun();
  const empty = { nameRu: "", nameEn: "", emoji: "👙", rarity: "common", price: String(DEFAULT_SKIN_PRICE), videoUrl: "" };
  const [f, setF] = useState(empty);
  const [k, setK] = useState(0);
  return (
    <div className="space-y-3 rounded-2xl bg-surface-2/50 p-4 ring-1 ring-line">
      <p className="flex items-center gap-2 font-semibold"><Shirt size={18} className="text-accent-2" /> {t.studio.skins}</p>
      {ep.skins.map((s) => (
        <div key={s.id} className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2">
          <span className="text-2xl">{s.emoji}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.nameRu}</span>
          <span className="text-xs text-muted">{t.spicy.rarity[s.rarity as keyof typeof t.spicy.rarity]}</span>
          <CoinAmount value={s.price} size={13} className="text-sm" />
          <button aria-label={t.common.delete} disabled={pending} onClick={() => confirm(t.studio.deleteConfirm) && run(() => deleteSkinAction(s.id))} className={btn("ghost", "icon", "h-8 w-8 text-red-300")}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <Uploader key={k} kind="video" accept="video/mp4,video/webm,video/quicktime" label={t.studio.skinVideo} onDone={(ref) => setF((x) => ({ ...x, videoUrl: ref }))} />
      <div className="grid grid-cols-[64px_1fr] gap-2">
        <input aria-label={t.studio.skinEmoji} value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} maxLength={8} className={clsx(inputCls, "px-2 text-center text-xl")} />
        <input aria-label={t.studio.skinName} placeholder={t.studio.skinName} value={f.nameRu} onChange={(e) => setF({ ...f, nameRu: e.target.value })} maxLength={40} className={inputCls} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input aria-label={t.studio.skinNameEn} placeholder={t.studio.skinNameEn} value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} maxLength={40} className={inputCls} />
        <select aria-label={t.studio.rarity} value={f.rarity} onChange={(e) => setF({ ...f, rarity: e.target.value })} className={inputCls}>
          {RARITIES.map((r) => <option key={r} value={r}>{t.spicy.rarity[r]}</option>)}
        </select>
        <input aria-label={t.studio.priceCoins} type="number" min={1} max={500} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className={inputCls} />
      </div>
      <button
        disabled={pending || !f.videoUrl || !f.nameRu}
        onClick={() => run(() => addSkinAction(ep.id, f), () => { setF(empty); setK((n) => n + 1); })}
        className={btn("glass", "md")}
      >
        <Plus size={17} /> {t.studio.addSkin}
      </button>
    </div>
  );
}

function SceneEditor({ ep }: { ep: Ep }) {
  const { t } = useI18n();
  const { pending, run } = useRun();
  const [f, setF] = useState({
    titleRu: ep.scene?.titleRu ?? "",
    titleEn: ep.scene?.titleEn ?? "",
    videoUrl: ep.scene?.videoUrl ?? "",
    durationSec: String(ep.scene?.durationSec ?? 30),
    price: String(ep.scene?.price ?? DEFAULT_SCENE_PRICE),
    triggerAtSec: ep.scene?.triggerAtSec != null ? String(ep.scene.triggerAtSec) : "",
  });
  const probe = (file: File) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      if (isFinite(v.duration)) setF((x) => ({ ...x, durationSec: String(Math.max(5, Math.round(v.duration))) }));
      URL.revokeObjectURL(v.src);
    };
    v.src = URL.createObjectURL(file);
  };
  return (
    <div className="space-y-3 rounded-2xl bg-surface-2/50 p-4 ring-1 ring-line">
      <p className="flex items-center gap-2 font-semibold"><Flame size={18} className="text-accent" /> {t.studio.scene}</p>
      <Uploader kind="video" accept="video/mp4,video/webm,video/quicktime" label={ep.scene ? `${t.studio.sceneVideo} ✓` : t.studio.sceneVideo} onDone={(ref) => setF((x) => ({ ...x, videoUrl: ref }))} onFile={probe} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input aria-label={t.studio.sceneTitle} placeholder={t.studio.sceneTitle} value={f.titleRu} onChange={(e) => setF({ ...f, titleRu: e.target.value })} maxLength={80} className={inputCls} />
        <input aria-label={t.studio.sceneTitleEn} placeholder={t.studio.sceneTitleEn} value={f.titleEn} onChange={(e) => setF({ ...f, titleEn: e.target.value })} maxLength={80} className={inputCls} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={labelCls}>{t.studio.priceCoins}</label>
          <input type="number" min={1} max={500} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.studio.duration}</label>
          <input type="number" min={5} max={600} value={f.durationSec} onChange={(e) => setF({ ...f, durationSec: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={clsx(labelCls, "truncate")} title={t.studio.sceneTrigger}>{t.studio.sceneTrigger}</label>
          <input type="number" min={0} value={f.triggerAtSec} onChange={(e) => setF({ ...f, triggerAtSec: e.target.value })} placeholder="—" className={inputCls} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={pending || !f.videoUrl || !f.titleRu} onClick={() => run(() => saveSceneAction(ep.id, f))} className={btn("glass", "md")}>
          <Flame size={17} /> {t.studio.saveScene}
        </button>
        {ep.scene && (
          <button disabled={pending} onClick={() => confirm(t.studio.deleteConfirm) && run(() => deleteSceneAction(ep.id))} className={btn("danger", "md")}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function CharactersEditor({ seriesId, characters }: { seriesId: string; characters: StudioCharacter[] }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<string | "new" | null>(characters.length ? null : "new");
  return (
    <div className="space-y-3">
      <div>
        <p className="flex items-center gap-2 font-semibold"><MessageCircleHeart size={18} className="text-accent-2" /> {t.studio.characters}</p>
        <p className="mt-1 text-sm text-muted">{t.studio.charactersSub}</p>
      </div>
      {characters.map((c) => (
        <div key={c.id} className="rounded-2xl bg-surface-2/50 ring-1 ring-line">
          <button onClick={() => setEditing(editing === c.id ? null : c.id)} className="flex w-full items-center gap-3 p-3 text-left">
            <CharacterAvatar c={{ name: c.nameRu, avatar: c.avatarPreview, hue: c.hue }} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.nameRu} <span className="text-sm font-normal text-muted">· {c.age}</span></p>
              <p className="truncate text-xs text-muted">{c.taglineRu}</p>
            </div>
            <span className="text-xs text-muted">📸 {c.photos.length}</span>
          </button>
          {editing === c.id && (
            <div className="space-y-5 border-t border-line p-4">
              <CharacterForm seriesId={seriesId} c={c} onDone={() => setEditing(null)} />
              <PhotosEditor c={c} />
            </div>
          )}
        </div>
      ))}
      {editing === "new" ? (
        <div className="rounded-2xl bg-surface-2/50 p-4 ring-1 ring-line">
          <CharacterForm seriesId={seriesId} onDone={() => setEditing(null)} />
        </div>
      ) : (
        <button onClick={() => setEditing("new")} className={btn("glass", "md")}>
          <UserPlus size={17} /> {t.studio.addCharacter}
        </button>
      )}
    </div>
  );
}

function CharacterForm({ seriesId, c, onDone }: { seriesId: string; c?: StudioCharacter; onDone: () => void }) {
  const { t } = useI18n();
  const { pending, run } = useRun();
  const [f, setF] = useState({
    id: c?.id ?? "",
    nameRu: c?.nameRu ?? "",
    nameEn: c?.nameEn ?? "",
    taglineRu: c?.taglineRu ?? "",
    taglineEn: c?.taglineEn ?? "",
    greetingRu: c?.greetingRu ?? "",
    greetingEn: c?.greetingEn ?? "",
    persona: c?.persona ?? "",
    age: String(c?.age ?? 24),
    avatarUrl: c?.avatarUrl ?? "",
    hue: String(c?.hue ?? 330),
  });
  const field = (key: keyof typeof f, label: string, max: number) => (
    <div>
      <label className={labelCls}>{label}</label>
      <input value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} maxLength={max} className={inputCls} />
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <Uploader kind="image" accept="image/png,image/jpeg,image/webp" label={t.studio.charAvatar} onDone={(ref) => setF((x) => ({ ...x, avatarUrl: ref }))} preview={c?.avatarPreview} aspect="aspect-square" />
        <div className="grid gap-3 sm:grid-cols-2">
          {field("nameRu", t.studio.charName, 40)}
          {field("nameEn", t.studio.charNameEn, 40)}
          {field("taglineRu", t.studio.charTagline, 120)}
          {field("taglineEn", t.studio.charTaglineEn, 120)}
          <div>
            <label className={labelCls}>{t.studio.charAge}</label>
            <input type="number" min={18} max={150} value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t.studio.form.hue}</label>
            <input type="range" min={0} max={360} value={f.hue} onChange={(e) => setF({ ...f, hue: e.target.value })} className="mt-4 w-full accent-[var(--accent)]" />
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("greetingRu", t.studio.charGreeting, 400)}
        {field("greetingEn", t.studio.charGreetingEn, 400)}
      </div>
      <div>
        <label className={labelCls}>{t.studio.charPersona}</label>
        <textarea value={f.persona} onChange={(e) => setF({ ...f, persona: e.target.value })} rows={5} maxLength={4000} placeholder={t.studio.charPersonaHint} className={textareaCls} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={pending || !f.nameRu || f.persona.trim().length < 20 || Number(f.age) < 18} onClick={() => run(() => saveCharacterAction(seriesId, f), onDone)} className={btn("primary", "md")}>
          {t.common.save}
        </button>
        {c && (
          <button disabled={pending} onClick={() => confirm(t.studio.deleteConfirm) && run(() => deleteCharacterAction(c.id))} className={btn("danger", "md")}>
            <Trash2 size={16} /> {t.common.delete}
          </button>
        )}
      </div>
      {Number(f.age) < 18 && <p className="text-sm text-red-300">{t.studio.adultOnly}</p>}
    </div>
  );
}

function PhotosEditor({ c }: { c: StudioCharacter }) {
  const { t } = useI18n();
  const { pending, run } = useRun();
  const [f, setF] = useState({ imageUrl: "", captionRu: "", captionEn: "", price: String(DEFAULT_PHOTO_PRICE) });
  const [k, setK] = useState(0);
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{t.studio.photos}</p>
      <div className="flex flex-wrap gap-2">
        {c.photos.map((p) => (
          <div key={p.id} className="group relative w-24 overflow-hidden rounded-xl ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="" className="aspect-[3/4] w-full object-cover" />
            <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 text-[11px] font-semibold text-coin">{p.price}</span>
            <button aria-label={t.common.delete} disabled={pending} onClick={() => run(() => deletePhotoAction(p.id))} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-red-300">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <Uploader key={k} kind="private" accept="image/png,image/jpeg,image/webp" label={t.studio.addPhoto} onDone={(ref) => setF((x) => ({ ...x, imageUrl: ref }))} aspect="aspect-[3/4]" />
        <div className="space-y-2">
          <input aria-label={t.studio.photoCaption} placeholder={t.studio.photoCaption} value={f.captionRu} onChange={(e) => setF({ ...f, captionRu: e.target.value })} maxLength={120} className={inputCls} />
          <div className="flex gap-2">
            <input aria-label={t.studio.priceCoins} type="number" min={1} max={500} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className={clsx(inputCls, "w-28")} />
            <button disabled={pending || !f.imageUrl} onClick={() => run(() => addPhotoAction(c.id, f), () => { setF({ imageUrl: "", captionRu: "", captionEn: "", price: String(DEFAULT_PHOTO_PRICE) }); setK((n) => n + 1); })} className={btn("glass", "md", "flex-1")}>
              <ImagePlus size={17} /> {t.studio.addPhoto}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
