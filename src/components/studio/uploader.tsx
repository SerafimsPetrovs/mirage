"use client";
import { useRef, useState } from "react";
import { UploadCloud, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/shared";

/** Uploads a file to /api/studio/upload with progress; reports the storage ref. */
export function Uploader({
  kind,
  accept,
  label,
  onDone,
  onFile,
  preview,
  aspect = "aspect-[9/16]",
}: {
  kind: "video" | "image" | "private" | "installer";
  accept: string;
  label: string;
  onDone: (ref: string) => void;
  onFile?: (file: File) => void;
  preview?: string | null;
  aspect?: string;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const upload = (file: File) => {
    setError(null);
    setDone(null);
    onFile?.(file);
    if (kind !== "video") setLocalPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/studio/upload");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status === 200 && res.ref) {
          setDone(file.name);
          onDone(res.ref);
        } else setError(res.error ?? "upload_failed");
      } catch {
        setError("upload_failed");
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("network");
    };
    xhr.send(fd);
  };

  const shown = localPreview ?? preview;

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-muted">{label}</p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) upload(f);
        }}
        className={clsx(
          "relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line-strong bg-surface-2 text-center text-sm text-muted transition hover:border-accent/60",
          kind !== "video" ? aspect : "h-28",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {shown && kind !== "video" && <img src={shown} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />}
        <span className="relative flex flex-col items-center gap-1.5 rounded-xl bg-black/40 px-3 py-2">
          {done ? <CheckCircle2 size={22} className="text-ok" /> : <UploadCloud size={22} />}
          {progress !== null ? fmt(t.studio.uploading, { p: progress }) : done ? <span className="max-w-[180px] truncate">{done}</span> : t.studio.upload}
        </span>
        {progress !== null && (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
            <span className="block h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </span>
        )}
      </button>
      {error && <p className="mt-1.5 text-xs text-red-300">{error}</p>}
      <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
    </div>
  );
}
