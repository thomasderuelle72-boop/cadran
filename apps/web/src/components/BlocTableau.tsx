import type { Bloc, Mesure, SerieExercice } from "../api/types";
import { formatRatioValue } from "../lib/format";

/**
 * Le bloc « tableau », et la vue de repli de tous les autres.
 *
 * Il existe pour deux raisons. La première est qu'un tableau répond mieux que
 * n'importe quel graphique à « combien exactement, en 2024 ? » — question que
 * se pose tout de même un comptable devant une courbe. La seconde est une
 * obligation : la séparation de la pire paire de couleurs tombe dans la bande
 * plancher, ce qui exige un second encodage. Un tableau accessible à côté de
 * chaque graphique en est un, et c'est celui qui ne dépend d'aucune couleur.
 *
 * C'est aussi le seul bloc qui admet des unités différentes : sans axe
 * commun, rien ne se superpose, donc rien ne ment.
 */

/** Variation entre deux exercices, en points de pourcentage ou en taux. */
function variation(courant: number | null, precedent: number | null): number | null {
  if (courant === null || precedent === null || precedent === 0) return null;
  return (courant - precedent) / Math.abs(precedent);
}

function Variation({ valeur }: { valeur: number | null }) {
  if (valeur === null) return <span className="text-ink-3">—</span>;
  const signe = valeur > 0 ? "+" : "";
  /*
   * Pas de couleur verte ou rouge : une hausse n'est pas une bonne nouvelle
   * en soi. Une progression des charges de personnel de 12 % peinte en vert
   * parce qu'elle monte dirait exactement le contraire de ce qu'elle vaut.
   */
  return (
    <span className="tabular-nums text-ink-3">
      {signe}
      {(valeur * 100).toFixed(1)} %
    </span>
  );
}

export function BlocTableau({
  bloc,
  exercices,
  mesures,
  currency,
}: {
  bloc: Bloc;
  exercices: SerieExercice[];
  mesures: Map<string, Mesure>;
  currency: string;
}) {
  if (exercices.length === 0) {
    return <p className="text-sm text-ink-3">Aucun exercice à afficher.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink-3 border-b border-rule/10">
            <th className="py-2 pr-4 font-medium">Mesure</th>
            {exercices.map((exercice) => (
              <th
                key={exercice.annee}
                className={`py-2 pr-4 text-right font-medium ${exercice.reel ? "" : "text-primary"}`}
              >
                {exercice.label}
                {!exercice.reel && <span className="block text-[0.6rem] normal-case">projeté</span>}
                {exercice.reel && !exercice.complet && (
                  <span className="block text-[0.6rem] normal-case text-warning">partiel</span>
                )}
              </th>
            ))}
            {exercices.length > 1 && <th className="py-2 text-right font-medium">Var.</th>}
          </tr>
        </thead>
        <tbody>
          {bloc.mesures.map((id) => {
            const mesure = mesures.get(id);
            const valeurs = exercices.map((exercice) => exercice.valeurs[id] ?? null);
            return (
              <tr key={id} className="border-b border-rule/5 last:border-0">
                <td className="py-2 pr-4">{mesure?.label ?? id}</td>
                {valeurs.map((valeur, index) => (
                  <td
                    key={exercices[index].annee}
                    className="py-2 pr-4 text-right tabular-nums font-mono text-ink-2"
                  >
                    {formatRatioValue(valeur, mesure?.unite ?? "ratio", currency)}
                  </td>
                ))}
                {exercices.length > 1 && (
                  <td className="py-2 text-right">
                    <Variation
                      valeur={variation(valeurs[valeurs.length - 1], valeurs[valeurs.length - 2])}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Tuile : un seul chiffre, et sa variation.
 *
 * La forme juste quand la donnée n'a qu'une valeur à montrer. Lui donner un
 * graphique ferait un trait entre deux points, ce qui n'apprend rien que le
 * nombre ne dise mieux.
 */
export function BlocTuile({
  bloc,
  exercices,
  mesures,
  currency,
}: {
  bloc: Bloc;
  exercices: SerieExercice[];
  mesures: Map<string, Mesure>;
  currency: string;
}) {
  const id = bloc.mesures[0];
  const mesure = mesures.get(id);

  /*
   * Un chiffre clé est un constat, pas une prévision.
   *
   * Afficher « 1 834 836 € » en gros caractères pour un exercice projeté
   * donne à une hypothèse l'allure d'un fait — la mention « projeté » en
   * petit dessous ne rattrape pas ce que l'œil a déjà pris. La tuile montre
   * donc toujours le dernier exercice réalisé ; la projection se lit sur les
   * courbes, où elle est au milieu de sa trajectoire et se discute.
   */
  const realises = exercices.filter((exercice) => exercice.reel);
  const serie = realises.length > 0 ? realises : exercices;
  const dernier = serie[serie.length - 1];
  const precedent = serie[serie.length - 2];

  if (!dernier) return <p className="text-sm text-ink-3">Aucun exercice.</p>;

  const valeur = dernier.valeurs[id] ?? null;
  const ecart = variation(valeur, precedent?.valeurs[id] ?? null);

  return (
    <div>
      <div className="font-display text-3xl font-semibold tabular-nums">
        {formatRatioValue(valeur, mesure?.unite ?? "devise", currency)}
      </div>
      <div className="mt-1 flex items-baseline gap-2 text-xs text-ink-3">
        <span>
          {dernier.label}
          {!dernier.reel && " · projeté"}
          {dernier.reel && !dernier.complet && " · exercice partiel"}
        </span>
        {ecart !== null && (
          <span>
            <Variation valeur={ecart} /> vs {precedent.label}
          </span>
        )}
      </div>
    </div>
  );
}
