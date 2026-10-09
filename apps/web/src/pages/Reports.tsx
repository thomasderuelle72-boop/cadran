import { useMemo, useState } from "react";
import { useEntities, usePeriods } from "../api/hooks";
import { useDossierCourant } from "../lib/dossierCourant";
import { downloadFile } from "../api/client";
import { EntetePage, EtatVide, SqueletteTableau, Zone } from "../components/etats";
import { formatDate } from "../lib/format";

/**
 * Les rapports à télécharger, période par période.
 *
 * Par défaut, ceux du dossier choisi en haut — la liste mêlait tous les
 * dossiers du cabinet, et dans un portefeuille de plusieurs centaines de
 * dossiers on n'y retrouvait rien. Le plus récent d'abord.
 */
export function ReportsPage() {
  const { data: entites } = useEntities();
  const [entityId] = useDossierCourant(entites);
  const [tous, setTous] = useState(false);
  const { data: toutes, isLoading, error, refetch } = usePeriods();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const dossier = entites?.find((e) => e.id === entityId);

  const periods = useMemo(
    () =>
      (toutes ?? [])
        .filter((p) => tous || (p.entityId ?? p.entity?.id) === entityId)
        .sort((a, b) => b.endDate.localeCompare(a.endDate) || (a.entity?.name ?? "").localeCompare(b.entity?.name ?? "", "fr")),
    [toutes, tous, entityId],
  );

  async function handleDownload(periodId: string, label: string, format: "pdf" | "xlsx", nomDossier?: string) {
    setDownloadingId(`${periodId}:${format}`);
    try {
      await downloadFile(
        `/periods/${periodId}/report.${format}`,
        `cadran-${[nomDossier, label].filter(Boolean).join("-").replace(/\s+/g, "-").toLowerCase()}.${format}`
      );
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <EntetePage titre="Rapports" sousTitre="Le rapport de synthèse de chaque période, en PDF ou en Excel.">
        {(entites?.length ?? 0) > 1 && (
          <div className="flex gap-0.5 p-0.5 rounded-lg bg-ink/[0.06]" role="radiogroup" aria-label="Dossiers">
            {[
              { valeur: false, libelle: dossier?.name ?? "Ce dossier" },
              { valeur: true, libelle: "Tous les dossiers" },
            ].map((option) => (
              <button
                key={String(option.valeur)}
                type="button"
                role="radio"
                aria-checked={tous === option.valeur}
                onClick={() => setTous(option.valeur)}
                className={`max-w-[16rem] truncate rounded-md px-2.5 py-1 text-sm font-medium transition ${
                  tous === option.valeur ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"
                }`}
              >
                {option.libelle}
              </button>
            ))}
          </div>
        )}
      </EntetePage>

      <Zone
        chargement={isLoading}
        erreur={error}
        onReessayer={() => void refetch()}
        quoi="les périodes"
        squelette={<SqueletteTableau lignes={6} colonnes={4} />}
      >
      {toutes && periods.length === 0 && (
        <EtatVide titre="Aucune période" action={{ to: "/import", label: "Importer des données" }}>
          Un rapport se génère par période : importez des données pour en produire un.
        </EtatVide>
      )}

      {periods.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-3 border-b border-rule/10">
                {tous && <th className="py-2">Dossier</th>}
                <th className="py-2">Période</th>
                <th className="py-2">Dates</th>
                <th className="py-2">Lignes importées</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id} className="border-b border-rule/5 last:border-0">
                  {tous && <td className="py-2.5 text-ink-3">{p.entity?.name ?? "—"}</td>}
                  <td className="py-2.5 font-medium">{p.label}</td>
                  <td className="py-2.5 text-ink-3">
                    {formatDate(p.startDate)} — {formatDate(p.endDate)}
                  </td>
                  <td className="py-2.5 text-ink-3">{p._count?.lineItems ?? 0}</td>
                  <td className="py-2.5 text-right space-x-2">
                    <button
                      className="btn-secondary"
                      disabled={downloadingId === `${p.id}:pdf` || !p._count?.lineItems}
                      onClick={() => handleDownload(p.id, p.label, "pdf", p.entity?.name)}
                    >
                      {downloadingId === `${p.id}:pdf` ? "Génération…" : "PDF"}
                    </button>
                    <button
                      className="btn-secondary"
                      disabled={downloadingId === `${p.id}:xlsx` || !p._count?.lineItems}
                      onClick={() => handleDownload(p.id, p.label, "xlsx", p.entity?.name)}
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
