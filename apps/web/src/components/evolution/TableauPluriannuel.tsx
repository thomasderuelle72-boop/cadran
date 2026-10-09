import { Fragment } from "react";
import type { SerieExercice } from "../../api/types";
import { formatRatioValue } from "../../lib/format";
import { valeur } from "../../lib/evolution";
import { GROUPES, ecartLigne, type LigneTableau } from "../../lib/tableauPluriannuel";
import { MiniCourbe } from "./MiniCourbe";

const COULEUR_ECART = {
  favorable: "text-success",
  defavorable: "text-critical",
  neutre: "text-ink-3",
} as const;

/**
 * Le tableau pluriannuel, comme dans une plaquette : une colonne par
 * exercice, puis l'écart du dernier sur le précédent, la part du chiffre
 * d'affaires et la tendance.
 *
 * L'écart se lit en couleur *et* en signe : la couleur dit si c'est une bonne
 * nouvelle (des charges qui montent n'en sont pas une), le signe dit le sens.
 */
export function TableauPluriannuel({
  exercices,
  lignes,
  devise,
}: {
  exercices: SerieExercice[];
  lignes: LigneTableau[];
  devise: string;
}) {
  const dernier = exercices[exercices.length - 1];
  const precedent = exercices.length > 1 ? exercices[exercices.length - 2] : null;
  const caDernier = dernier ? valeur(dernier, "agregat.chiffreAffaires") : null;

  return (
    <div className="card p-0 overflow-x-auto">
      <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-ink-3 border-b border-rule/10 bg-surface-2">
            <th className="sticky left-0 bg-surface-2 px-4 py-2.5 text-left font-semibold">Poste</th>
            {exercices.map((e) => (
              <th key={e.annee} className="px-3 py-2.5 text-right font-semibold">
                {e.label}
              </th>
            ))}
            {precedent && (
              <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                Écart {dernier.label}/{precedent.label}
              </th>
            )}
            <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">% du CA {dernier.label}</th>
            <th className="px-4 py-2.5 text-center font-semibold">Tendance</th>
          </tr>
        </thead>
        <tbody>
          {GROUPES.map((groupe) => {
            const duGroupe = lignes.filter((l) => l.groupe === groupe);
            if (duGroupe.length === 0) return null;
            return (
              <Fragment key={groupe}>
                <tr>
                  <th
                    colSpan={exercices.length + 4}
                    className="sticky left-0 px-4 pt-4 pb-1.5 text-left text-xs font-bold uppercase tracking-wide text-primary"
                  >
                    {groupe}
                  </th>
                </tr>
                {duGroupe.map((ligne) => {
                  const valeurs = exercices.map((e) => ligne.calcul(e));
                  const vDernier = valeurs[valeurs.length - 1];
                  const ecart = precedent ? ecartLigne(ligne, valeurs[valeurs.length - 2], vDernier) : null;
                  const partCa =
                    ligne.flux && ligne.id !== "ca" && vDernier !== null && caDernier !== null && caDernier > 0
                      ? vDernier / caDernier
                      : null;
                  return (
                    <tr key={ligne.id} className="border-t border-rule/[0.06] hover:bg-ink/[0.02]">
                      <th
                        scope="row"
                        className={`sticky left-0 bg-surface px-4 py-2 text-left ${ligne.total ? "font-semibold" : "font-normal text-ink-2 pl-6"}`}
                      >
                        {ligne.libelle}
                      </th>
                      {valeurs.map((v, i) => (
                        <td
                          key={exercices[i].annee}
                          className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${
                            i === valeurs.length - 1 ? "font-semibold" : "text-ink-2"
                          } ${v !== null && v < 0 && ligne.unite === "devise" ? "text-critical" : ""}`}
                        >
                          {formatRatioValue(v, ligne.unite, devise)}
                        </td>
                      ))}
                      {precedent && (
                        <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${ecart ? COULEUR_ECART[ecart.lecture] : "text-ink-3"}`}>
                          {ecart?.texte ?? "—"}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right tabular-nums text-ink-3 whitespace-nowrap">
                        {partCa === null ? "" : formatRatioValue(partCa, "pourcentage")}
                      </td>
                      <td className="px-4 py-1 text-center">
                        <MiniCourbe valeurs={valeurs} />
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
