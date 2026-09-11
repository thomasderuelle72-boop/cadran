import { useRef, useState } from "react";
import { useExercicesFec, useImportFec } from "../api/hooks";
import { ApiError } from "../api/client";
import { formatCurrency, formatDate } from "../lib/format";
import type { ResumeImportFec } from "../api/types";

function Resume({ resume }: { resume: ResumeImportFec }) {
  return (
    <div className="rounded-lg border border-success/30 bg-success/5 p-4 space-y-3">
      <div>
        <span className="font-semibold text-success">Exercice {resume.exercice} importé.</span>{" "}
        <span className="text-sm">
          {resume.ecrituresImportees.toLocaleString("fr-FR")} écritures
          {resume.debutExercice && resume.finExercice && (
            <>
              {" "}
              du {formatDate(resume.debutExercice)} au {formatDate(resume.finExercice)}
            </>
          )}
          , {resume.periodes.length} périodes mensuelles.
        </span>
      </div>

      {resume.equilibre ? (
        <p className="text-xs text-ink/50">
          Débit et crédit se compensent exactement ({formatCurrency(resume.totalDebit)}) : le fichier
          est complet.
        </p>
      ) : (
        <p className="text-sm text-critical">
          <span className="font-semibold">Fichier déséquilibré</span> de{" "}
          {formatCurrency(resume.ecart)}. Un FEC complet a toujours un total débit égal au total
          crédit : celui-ci est probablement tronqué, et tout ce qui en découle sera faux.
        </p>
      )}

      {resume.lignesIgnorees > 0 && (
        <div className="text-sm">
          <span className="text-warning font-medium">
            {resume.lignesIgnorees} ligne{resume.lignesIgnorees > 1 ? "s" : ""} ignorée
            {resume.lignesIgnorees > 1 ? "s" : ""}
          </span>
          <ul className="mt-1 space-y-0.5 text-xs text-ink/60 font-mono">
            {resume.erreurs.slice(0, 5).map((erreur) => (
              <li key={`${erreur.ligne}-${erreur.message}`}>
                ligne {erreur.ligne} — {erreur.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {resume.comptesNonClasses.length > 0 && (
        <div className="text-sm">
          <span className="text-warning font-medium">
            {resume.comptesNonClasses.length} compte
            {resume.comptesNonClasses.length > 1 ? "s" : ""} non classé
            {resume.comptesNonClasses.length > 1 ? "s" : ""}
          </span>
          <p className="text-xs text-ink/50 mt-0.5">
            Aucun préfixe du plan comptable ne les rattache à un poste : leurs montants n&apos;entrent
            dans aucun calcul.
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-ink/60 font-mono">
            {resume.comptesNonClasses.slice(0, 5).map((compte) => (
              <li key={compte.accountCode}>
                {compte.accountCode} — {compte.label} ({formatCurrency(compte.mouvement)})
              </li>
            ))}
          </ul>
        </div>
      )}

      {resume.periodesManuellesRecouvrantes.length > 0 && (
        <p className="text-sm text-warning">
          {resume.periodesManuellesRecouvrantes.map((p) => p.label).join(", ")} recouvre
          {resume.periodesManuellesRecouvrantes.length > 1 ? "nt" : ""} l&apos;exercice importé. Ces
          périodes saisies à la main n&apos;ont pas été modifiées, mais elles font désormais double
          emploi avec les périodes mensuelles : supprimez-les si elles ne servent plus.
        </p>
      )}
    </div>
  );
}

export function FecImport({ entityId, entityName }: { entityId: string; entityName?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const importFec = useImportFec();
  const { data: exercices } = useExercicesFec(entityId || null);
  const [resume, setResume] = useState<ResumeImportFec | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(file: File) {
    setErreur(null);
    setResume(null);
    try {
      setResume(await importFec.mutateAsync({ entityId, file }));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Import impossible.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">
          Importer un Fichier des Écritures Comptables
        </h2>
        <p className="text-sm text-ink/50 mt-1">
          Le FEC est le format normé que tout logiciel comptable exporte. Ses colonnes étant fixées
          par l&apos;arrêté du 29 juillet 2013, il n&apos;y a aucune correspondance à établir : un
          seul fichier remplace douze imports de balance, et il apporte le détail par compte, le
          tiers et le lettrage — sans lesquels ni la balance âgée ni la concentration ne sont
          calculables.
        </p>
      </div>

      {exercices && exercices.length > 0 && (
        <div className="text-sm">
          <span className="text-ink/50">Exercices déjà importés{entityName ? ` pour ${entityName}` : ""} : </span>
          {exercices.map((exercice) => (
            <span key={exercice.exercice} className="font-mono mr-3">
              {exercice.exercice}{" "}
              <span className="text-ink/40">({exercice.ecritures.toLocaleString("fr-FR")} écritures)</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={inputRef}
          id="fichier-fec"
          type="file"
          accept=".txt,.csv,.tsv,text/plain"
          className="hidden"
          disabled={!entityId || importFec.isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void envoyer(file);
          }}
        />
        <button
          type="button"
          className="btn-primary"
          disabled={!entityId || importFec.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {importFec.isPending ? "Import en cours…" : "Choisir un fichier FEC"}
        </button>
        <span className="text-xs text-ink/40">
          Réimporter le même exercice le remplace intégralement, sans créer de doublon.
        </span>
      </div>

      {erreur && <p className="text-sm text-critical">{erreur}</p>}
      {resume && <Resume resume={resume} />}
    </div>
  );
}
