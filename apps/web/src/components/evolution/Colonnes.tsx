import { useMonte } from "../../lib/animation";
import { montantCourt, pourcentSigne } from "../../lib/evolution";

export interface Colonne {
  libelle: string;
  valeur: number | null;
  /** Variation sur la colonne précédente, en taux ; absente sur une base non positive. */
  variation?: number | null;
  /** Un exercice projeté : hachuré, jamais plein. */
  projete?: boolean;
}

/** Le hachuré du prévisionnel, selon la notation IBCS : plein = réalisé, hachuré = projeté. */
export const HACHURE = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgb(var(--serie-1) / 0.75) 0 2px, transparent 2px 6px)",
  boxShadow: "inset 0 0 0 1.5px rgb(var(--serie-1))",
} as const;

/**
 * Un montant par exercice, en colonnes : la forme la plus directe pour lire
 * « ça monte ou ça baisse ».
 *
 * Chaque colonne porte sa valeur et sa variation ; les graduations n'auraient
 * rien à ajouter. Le dernier réalisé est plein, les précédents plus clairs,
 * les projetés hachurés. Une valeur négative descend sous la ligne du zéro,
 * dans la couleur d'état critique : une trésorerie qui manque doit se voir.
 * Dessiné en HTML pour garder des étiquettes nettes à toute largeur.
 */
export function Colonnes({ colonnes, hauteur = 168 }: { colonnes: Colonne[]; hauteur?: number }) {
  const monte = useMonte();
  const valeurs = colonnes.map((c) => c.valeur ?? 0);
  const max = Math.max(0, ...valeurs);
  const min = Math.min(0, ...valeurs);
  const etendue = max - min || 1;
  const zero = (-min / etendue) * hauteur; // distance du zéro au bas de la zone
  const dernierReel = colonnes.map((c) => !c.projete).lastIndexOf(true);
  const marge = 22; // place des étiquettes au-dessus et au-dessous des barres

  return (
    <ol className="flex items-stretch gap-2 sm:gap-4" aria-label="Montant par exercice">
      {colonnes.map((c, rang) => {
        const v = c.valeur ?? 0;
        const taille = (Math.abs(v) / etendue) * hauteur;
        const negatif = v < 0;
        const accent = rang === dernierReel;
        const couleur = negatif ? "bg-critical" : c.projete ? "" : accent ? "bg-serie-1" : "bg-serie-1/45";
        return (
          <li key={c.libelle} className="flex-1 min-w-0 flex flex-col items-center">
            <div className="relative w-full" style={{ height: hauteur + 2 * marge }}>
              {/* Le zéro, pour qu'un manque se voie passer de l'autre côté. */}
              {min < 0 && (
                <span className="absolute inset-x-0 h-px bg-ink/25" style={{ bottom: marge + zero }} aria-hidden="true" />
              )}
              <span
                className={`absolute left-1/2 -translate-x-1/2 w-full max-w-[4.5rem] transition-[height] duration-700 ease-out ${couleur} ${
                  negatif ? "rounded-b-[4px]" : "rounded-t-[4px]"
                }`}
                style={{
                  ...(negatif ? { top: marge + hauteur - zero } : { bottom: marge + zero }),
                  height: monte ? Math.max(2, taille) : 0,
                  transitionDelay: `${rang * 60}ms`,
                  ...(c.projete && !negatif ? HACHURE : {}),
                }}
                aria-hidden="true"
              />
              <span
                className={`absolute inset-x-0 text-center text-[0.8rem] tabular-nums ${
                  accent || negatif ? "font-bold" : "text-ink-2"
                } ${negatif ? "text-critical" : ""}`}
                style={
                  negatif
                    ? { top: marge + hauteur - zero + taille + 3 }
                    : { bottom: marge + zero + taille + 3 }
                }
              >
                {c.valeur === null ? "n/d" : montantCourt(c.valeur)}
              </span>
            </div>
            <span className="text-sm font-semibold">
              {c.libelle}
              {c.projete && <span className="font-normal text-ink-3"> prév.</span>}
            </span>
            <span className="text-xs text-ink-3 tabular-nums h-4">
              {c.variation === undefined || c.variation === null ? "" : pourcentSigne(c.variation)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** La légende réalisé / prévisionnel, quand les deux sont tracés. */
export function LegendeScenarios() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-ink-2" aria-hidden="true">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[3px] bg-serie-1" /> Réalisé
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[3px]" style={HACHURE} /> Prévisionnel
      </span>
    </div>
  );
}
