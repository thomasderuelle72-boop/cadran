import { useState } from "react";
import { usePeriods } from "../api/hooks";
import { downloadFile } from "../api/client";
import { EntetePage, EtatVide, SqueletteTableau, Zone } from "../components/etats";
import { formatDate } from "../lib/format";

export function ReportsPage() {
  const { data: periods, isLoading, error, refetch } = usePeriods();
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
      <EntetePage
        titre="Rapports"
        sousTitre="Générez un rapport PDF ou Excel de synthèse pour chaque période."
      />

      <Zone
        chargement={isLoading}
        erreur={error}
        onReessayer={() => void refetch()}
        quoi="les périodes"
        squelette={<SqueletteTableau lignes={6} colonnes={4} />}
      >
      {periods && periods.length === 0 && (
        <EtatVide titre="Aucune période" action={{ to: "/import", label: "Importer des données" }}>
          Un rapport se génère par période : importez des données pour en produire un.
        </EtatVide>
      )}

      {periods && periods.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-rule/10">
                <th className="py-2">Entité</th>
                <th className="py-2">Période</th>
                <th className="py-2">Dates</th>
                <th className="py-2">Lignes importées</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id} className="border-b border-rule/5 last:border-0">
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
      </Zone>
    </div>
  );
}
