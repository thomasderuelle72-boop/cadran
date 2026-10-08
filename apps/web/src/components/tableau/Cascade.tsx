import type { EtapeCascade } from "../../lib/tableauDeBord";
import { formatCurrency } from "../../lib/format";
import { abregerMontant } from "../Graphique";
import { useMonte } from "../../lib/animation";

/**
 * Du chiffre d'affaires au résultat net : où part chaque euro vendu.
 *
 * Une cascade couchée, lue de haut en bas comme un compte de résultat. Les
 * totaux (chiffre d'affaires, valeur ajoutée, EBITDA, résultat net) sont en
 * couleur de marque et partent de zéro ; ce qui s'en retranche est en gris,
 * suspendu entre deux totaux. C'est la forme « mise en avant » : on suit les
 * totaux, et le gris dit ce qui les sépare. Un résultat net négatif passe
 * dans la couleur d'état critique, et son étiquette le dit en toutes lettres.
 *
 * Dessinée en HTML plutôt qu'avec la bibliothèque de graphiques : sur
 * téléphone, le libellé passe au-dessus de sa barre au lieu de lui prendre
 * les deux tiers de la largeur, ce qu'un axe de graphique ne sait pas faire.
 * Chaque barre porte sa valeur : les graduations n'auraient rien à ajouter.
 */

/** Part de la largeur gardée à droite pour l'étiquette de la plus longue barre. */
const RESERVE_ETIQUETTE = 0.18;

export function Cascade({ etapes, currency }: { etapes: EtapeCascade[]; currency: string }) {
  const monte = useMonte();
  const min = Math.min(0, ...etapes.map((e) => e.bas));
  const max = Math.max(0, ...etapes.map((e) => e.haut));
  const etendue = max - min || 1;
  const position = (v: number) => ((v - min) / etendue) * (1 - RESERVE_ETIQUETTE) * 100;
  const zero = position(0);

  return (
    <ol className="space-y-2.5 sm:space-y-1.5" aria-label="Du chiffre d'affaires au résultat net">
      {etapes.map((e, rang) => {
        const total = e.nature === "total";
        const perte = total && e.montant < 0;
        const gauche = position(e.bas);
        const largeur = Math.max(position(e.haut) - gauche, 0.6);
        const signe = e.montant < 0 ? "−" : total || e.montant === 0 ? "" : "+";
        // L'étiquette se place après la barre, et jamais sur la ligne du zéro
        // quand la barre s'arrête juste avant elle.
        const etiquette = Math.max(gauche + largeur, zero);
        const valeur = `${signe}${abregerMontant(Math.abs(e.montant))} €`;
        return (
          <li
            key={e.libelle}
            title={`${e.libelle} : ${formatCurrency(e.montant, currency)}. ${e.aide}`}
            className="grid grid-cols-1 sm:grid-cols-[12.5rem_1fr] items-center gap-x-4 gap-y-1 rounded-md sm:px-1 sm:py-0.5 hover:bg-ink/[0.03]"
          >
            <span className={`text-sm truncate ${total ? "font-semibold" : "text-ink-2 sm:pl-3"}`}>
              {e.libelle}
              {perte && <span className="ml-1.5 text-xs font-semibold text-critical">perte</span>}
            </span>
            <div className="relative h-6">
              {/* Le zéro, pour qu'une perte se voie passer de l'autre côté. */}
              <span className="absolute inset-y-[-3px] w-px bg-ink/20" style={{ left: `${zero}%` }} aria-hidden="true" />
              <span
                className={`absolute inset-y-0.5 rounded-[4px] transition-[width] duration-700 ease-out ${
                  total ? (perte ? "bg-critical" : "bg-serie-1") : "bg-ink/20"
                }`}
                style={{
                  left: `${gauche}%`,
                  width: monte ? `${largeur}%` : 0,
                  transitionDelay: `${rang * 45}ms`,
                }}
                aria-hidden="true"
              />
              <span
                className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[0.8rem] tabular-nums ${
                  total ? "font-bold" : "text-ink-3"
                }`}
                style={{ left: `calc(${etiquette}% + 8px)` }}
              >
                {valeur}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
