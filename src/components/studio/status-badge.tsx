import clsx from "clsx";

const STYLES: Record<string, string> = {
  DRAFT: "bg-white/8 text-muted",
  PENDING: "bg-coin/15 text-coin",
  PUBLISHED: "bg-ok/15 text-ok",
  REJECTED: "bg-red-500/15 text-red-300",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={clsx("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", STYLES[status])}>{label}</span>;
}
