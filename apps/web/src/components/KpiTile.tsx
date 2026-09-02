export function KpiTile({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-ink/50 font-medium">{label}</div>
      <div className="font-mono text-2xl font-semibold text-primary mt-1">{value}</div>
      {sublabel && <div className="text-xs text-ink/50 mt-1">{sublabel}</div>}
    </div>
  );
}
