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
      {/* Le chiffre en encre et non en vert : le vert dit « bon » partout
          ailleurs, et un chiffre d'affaires n'est ni bon ni mauvais. */}
      <div className="text-sm font-medium text-ink-2">{label}</div>
      <div className="font-mono text-[1.75rem] leading-tight font-bold tracking-tight mt-1.5">{value}</div>
      {sublabel && <div className="text-sm text-ink-3 mt-1">{sublabel}</div>}
    </div>
  );
}
