import { useState } from "react";
import { usePeriods } from "../api/hooks";
import { downloadFile } from "../api/client";
import { formatDate } from "../lib/format";

export function ReportsPage() {
  const { data: periods, isLoading } = usePeriods();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownload(periodId: string, label: string, format: "pdf" | "xlsx") {
    setDownloadingId(`${periodId}:${format}`);
    try {
      await downloadFile(
        `/periods/${periodId}/report.${format}`,
        `cadran-${label.replace(/\s+/g, "-").toLowerCase()}.${format}`
      );
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Rapports</h1>
        <p className="text-sm text-ink/50">Générez un rapport PDF ou Excel de synthèse pour chaque période.</p>
      </div>

      {isLoading && <p className="text-ink/50">Chargement…</p>}

      {periods && periods.length === 0 && <p className="text-ink/50">Aucune période disponible pour le moment.</p>}

      {periods && periods.length > 0 && (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-black/10">
                <th className="py-2">Entité</th>
                <th className="py-2">Période</th>
                <th className="py-2">Dates</th>
                <th className="py-2">Lignes importées</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id} className="border-b border-black/5 last:border-0">
                  <td className="py-2.5 text-ink/60">{p.entity?.name ?? "—"}</td>
                  <td className="py-2.5 font-medium">{p.label}</td>
                  <td className="py-2.5 text-ink/60">
                    {formatDate(p.startDate)} — {formatDate(p.endDate)}
                  </td>
                  <td className="py-2.5 text-ink/60">{p._count?.lineItems ?? 0}</td>
                  <td className="py-2.5 text-right space-x-2">
                    <button
                      className="btn-secondary"
                      disabled={downloadingId === `${p.id}:pdf` || !p._count?.lineItems}
                      onClick={() => handleDownload(p.id, p.label, "pdf")}
                    >
                      {downloadingId === `${p.id}:pdf` ? "Génération…" : "PDF"}
                    </button>
                    <button
                      className="btn-secondary"
                      disabled={downloadingId === `${p.id}:xlsx` || !p._count?.lineItems}
                      onClick={() => handleDownload(p.id, p.label, "xlsx")}
                    >
                      {downloadingId === `${p.id}:xlsx` ? "Génération…" : "Excel"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
