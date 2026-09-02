import type { RatioStatus } from "../api/types";

const STYLES: Record<RatioStatus, string> = {
  bon: "bg-success-soft text-success",
  attention: "bg-warning-soft text-warning",
  critique: "bg-critical-soft text-critical",
  neutre: "bg-black/5 text-ink/50",
};

const LABELS: Record<RatioStatus, string> = {
  bon: "Bon",
  attention: "Attention",
  critique: "Critique",
  neutre: "—",
};

export function StatusBadge({ status }: { status: RatioStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
