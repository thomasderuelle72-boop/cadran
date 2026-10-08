import { useComparaisonSectorielle } from "../api/hooks";
import type { LectureSectorielle, RatioSectoriel } from "../api/types";

/**
 * Le dossier situé dans les quartiles de son secteur.
 *
 * La carte ne dit rien tant qu'aucun référentiel n'est chargé : annoncer une
 * fonction qui ne peut rien montrer à chaque dossier serait du bruit. Une fois
 * chargé, chaque raison d'absence a sa phrase, parce qu'elle appelle un geste
 * différent — renseigner le code NAF, attendre un exercice complet.
 *
 * Trois choses sont toujours à l'écran quand la comparaison s'affiche, et
 * aucune n'est décorative :
 * - la mention de source avec sa date, que la Banque de France exige ;
 * - les avertissements de représentativité, sans lesquels une TPE se lirait
 *   « sous la médiane » d'un échantillon de PME trois fois plus grandes ;
 * - le signe « ≈ » sur chaque ratio approché, avec ce qui le sépare de la
 *   définition publiée.
 */

function formater(valeur: number | null, unite: RatioSectoriel["unite"]): string {
  if (valeur === null) return "—";
  const nombre = (n: number, decimales: number) =>
    n.toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  switch (unite) {
    case "pourcentage":
      return `${nombre(valeur, 1)} %`;
    case "jours":
      return `${nombre(valeur, 0)} j`;
    case "milliers_euros":
      return `${nombre(valeur, 1)} k€`;
  }
}

const LECTURES: Record<LectureSectorielle, { libelle: string; texte: string; point: string } | null> = {
  favorable: { libelle: "Favorable", texte: "text-success", point: "text-success" },
  defavorable: { libelle: "Défavorable", texte: "text-critical", point: "text-critical" },
  intermediaire: null,
  neutre: null,
};

/**
 * La position en une bande : l'écart interquartile en gris, la médiane en
 * trait, le dossier en point.
 *
 * L'échelle couvre les quartiles et la valeur du dossier, quelle qu'elle soit :
 * un point qui sortirait du dessin ne dirait plus rien. La bande est un second
 * encodage de ce que le tableau dit déjà en chiffres ; elle est masquée aux
 * lecteurs d'écran, qui ont les chiffres.
 */
function Bande({ ratio }: { ratio: RatioSectoriel }) {
  if (!ratio.quartiles) return null;
  const { q1, q2, q3 } = ratio.quartiles;
  const v = ratio.valeur;
  const bas = Math.min(q1, v ?? q1);
  const haut = Math.max(q3, v ?? q3);
  const marge = (haut - bas) * 0.08 || 1;
  const min = bas - marge;
  const etendue = haut + marge - min;
  const x = (valeur: number) => 6 + ((valeur - min) / etendue) * 128;
  const lecture = ratio.position ? LECTURES[ratio.position.lecture] : null;

  return (
    <svg width="140" height="18" viewBox="0 0 140 18" aria-hidden className="block">
      <rect x={x(q1)} y="5" width={Math.max(x(q3) - x(q1), 1)} height="8" rx="2" className="fill-current text-ink/15" />
      <line x1={x(q2)} x2={x(q2)} y1="3" y2="15" strokeWidth="2" className="stroke-current text-ink-3" />
      {v !== null && (
        <circle
          cx={x(v)}
          cy="9"
          r="4"
          strokeWidth="2"
          className={`fill-current stroke-surface ${lecture ? lecture.point : "text-ink"}`}
        />
      )}
    </svg>
  );
}

const RAISONS: Record<string, string> = {
  naf_absent:
    "Renseignez le code NAF du dossier dans les paramètres pour le comparer aux entreprises de son secteur.",
  secteur_absent: "Aucune référence n'est publiée pour le secteur de ce dossier.",
  exercice_absent:
    "La comparaison porte sur un exercice complet, et ce dossier n'en a pas encore : les ratios d'une année partielle ne se comparent pas à ceux d'une année pleine.",
};

export function ComparaisonSectorielle({ entityId }: { entityId: string }) {
  const { data } = useComparaisonSectorielle(entityId);

  if (!data || (!data.disponible && data.raison === "referentiel_absent")) return null;

  if (!data.disponible) {
    return (
      <section className="card">
        <h2 className="font-display text-lg font-semibold">Comparaison sectorielle</h2>
        <p className="text-sm text-ink-3 mt-1 max-w-prose">
          {RAISONS[data.raison]}
          {data.raison === "secteur_absent" && data.codeNaf ? ` (NAF ${data.codeNaf})` : ""}
        </p>
      </section>
    );
  }

  const affiches = data.ratios.filter((r) => r.quartiles);

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Comparaison sectorielle</h2>
        <p className="text-sm text-ink-3 mt-0.5">
          {data.exercice} comparé aux entreprises{" "}
          {data.secteur.niveau === "division" ? "de la division" : "de la section"} {data.secteur.code} —{" "}
          {data.secteur.libelle.toLocaleLowerCase("fr")} — données {data.source.millesime}.
        </p>
      </div>

      {data.avertissements.length > 0 && (
        <ul className="rounded-md bg-warning-soft px-3 py-2 text-sm text-ink-2 space-y-1">
          {data.avertissements.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-3 border-b border-rule/10">
              <th scope="col" className="py-2 pr-3 font-medium">Ratio</th>
              <th scope="col" className="py-2 px-3 font-medium text-right">Ce dossier</th>
              <th scope="col" className="py-2 px-3 font-medium text-right" title="25 % des entreprises sont en dessous">Q1</th>
              <th scope="col" className="py-2 px-3 font-medium text-right">Médiane</th>
              <th scope="col" className="py-2 px-3 font-medium text-right" title="25 % des entreprises sont au-dessus">Q3</th>
              <th scope="col" className="py-2 px-3 font-medium"><span className="sr-only">Position</span></th>
              <th scope="col" className="py-2 pl-3 font-medium">Lecture</th>
            </tr>
          </thead>
          <tbody>
            {affiches.map((r) => {
              const lecture = r.position ? LECTURES[r.position.lecture] : null;
              return (
                <tr key={r.id} className="border-b border-rule/5 last:border-0 align-middle">
                  <td className="py-2.5 pr-3">
                    {r.libelle}
                    {r.comparabilite === "approchee" && (
                      <span className="text-ink-3 ml-1" title={`Calcul approché : ${r.ecart ?? ""}`}>
                        ≈
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-medium whitespace-nowrap">
                    {formater(r.valeur, r.unite)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-ink-3 whitespace-nowrap">
                    {formater(r.quartiles!.q1, r.unite)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-ink-3 whitespace-nowrap">
                    {formater(r.quartiles!.q2, r.unite)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-ink-3 whitespace-nowrap">
                    {formater(r.quartiles!.q3, r.unite)}
                  </td>
                  <td className="py-2.5 px-3">
                    <Bande ratio={r} />
                  </td>
                  <td className="py-2.5 pl-3 text-xs">
                    {r.position ? (
                      <>
                        <span className="text-ink-2">{r.position.phrase}</span>
                        {lecture && <span className={`block font-semibold ${lecture.texte}`}>{lecture.libelle}</span>}
                      </>
                    ) : (
                      <span className="text-ink-3">Non calculable pour ce dossier</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-ink-3 hover:text-ink">Comment ces ratios sont calculés</summary>
        <dl className="mt-3 space-y-2 text-xs text-ink-2">
          {affiches.map((r) => (
            <div key={r.id}>
              <dt className="font-medium text-ink-2">
                {r.libelle}
                {r.comparabilite === "exacte" ? " — calcul identique" : " — calcul approché"}
              </dt>
              <dd>
                {r.definition}
                {r.ecart && <span className="block text-ink-3">{r.ecart}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </details>

      <p className="text-xs text-ink-3">{data.source.mention}</p>
    </section>
  );
}
