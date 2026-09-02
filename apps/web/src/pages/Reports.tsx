import { useState } from "react";
import { usePeriods } from "../api/hooks";
import { downloadFile } from "../api/client";
import { formatDate } from "../lib/format";

export function ReportsPage() {
  const { data: periods, isLoading } = usePeriods();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownload(periodId: string, label: string) {
    setDownloadingId(periodId);
    try {
      await downloadFile(`/periods/${periodId}/report.pdf`, `cadran-${label.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Rapports</h1>
        <p className="text-sm text-ink/50">Générez un rapport PDF de synthèse pour chaque période clôturée.</p>
      </div>

      {isLoading && <p className="text-ink/50">Chargement…</p>}

      {periods && periods.length === 0 && <p className="text-ink/50">Aucune période disponible pour le moment.</p>}

      {periods && periods.length > 0 && (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-black/10">
                <th className="py-2">Période</th>
                <th className="py-2">Dates</th>
                <th className="py-2">Lignes importées</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id} className="border-b border-black/5 last:border-0">
                  <td className="py-2.5 font-medium">{p.label}</td>
                  <td className="py-2.5 text-ink/60">
                    {formatDate(p.startDate)} — {formatDate(p.endDate)}
                  </td>
                  <td className="py-2.5 text-ink/60">{p._count?.lineItems ?? 0}</td>
                  <td className="py-2.5 text-right">
                    <button
                      className="btn-secondary"
                      disabled={downloadingId === p.id || !p._count?.lineItems}
                      onClick={() => handleDownload(p.id, p.label)}
                    >
                      {downloadingId === p.id ? "Génération…" : "Télécharger le PDF"}
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
