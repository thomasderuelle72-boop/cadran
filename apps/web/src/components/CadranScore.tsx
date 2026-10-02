import type { ScoreRisque } from "../api/types";

/**
 * Un score de fragilité, lu comme sur un instrument.
 *
 * Il remplace la règle linéaire. L'arc n'est pas une décoration : c'est la
 * même échelle, placée autrement. Un score se lit par rapport à ses seuils
 * publiés, jamais dans l'absolu — « 6,46 » ne veut rien dire sans savoir que
 * la sécurité commence à 2,9.
 *
 * L'échelle couvre les deux seuils avec une marge égale de part et d'autre,
 * pour qu'un cas extrême reste visible au bord plutôt que collé à la butée.
 *
 * Toutes les couleurs viennent des jetons : le cadran suit la palette
 * choisie, y compris en clair, où un instrument doit rester lisible sur du
 * papier.
 */

const RAYON = 62;
const CENTRE_X = 80;
const CENTRE_Y = 78;
/* De la place pour les étiquettes extérieures : posées à RAYON + 16, elles
 * sortent d'un cadre qui s'arrêterait à la largeur du seul arc. */
const CADRE = { x: -10, y: -10, largeur: 180, hauteur: 122 };

/**
 * Arrondit une graduation pour l'affichage.
 *
 * Les bornes de l'échelle sont calculées — `seuilDanger − étendue` — et
 * l'arithmétique flottante en fait « -0,0099999999999 ». Affiché tel quel,
 * un seuil publié passe pour un chiffre bricolé. La précision suit l'ordre
 * de grandeur : deux décimales pour un score qui se joue au centième
 * (Conan & Holder), une seule pour un score en unités (Altman).
 */
function graduationLisible(valeur: number, etendue: number): string {
  const decimales = etendue < 1 ? 2 : 1;
  const arrondi = Number(valeur.toFixed(decimales));
  return arrondi.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  });
}

export function CadranScore({ score }: { score: ScoreRisque }) {
  if (score.valeur === null) return null;

  const etendue = score.seuilSain - score.seuilDanger;
  const min = score.seuilDanger - etendue;
  const max = score.seuilSain + etendue;
  const borne = (v: number) => Math.min(max, Math.max(min, v));

  /* Demi-tour : min à gauche (π), max à droite (0). */
  const angle = (v: number) => Math.PI * (1 - (borne(v) - min) / (max - min));
  const point = (v: number, rayon: number): [number, number] => [
    CENTRE_X + rayon * Math.cos(angle(v)),
    CENTRE_Y - rayon * Math.sin(angle(v)),
  ];
  const arc = (de: number, a: number, rayon: number) => {
    const [x1, y1] = point(de, rayon);
    const [x2, y2] = point(a, rayon);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rayon} ${rayon} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  const [aiguilleX, aiguilleY] = point(score.valeur, RAYON - 12);
  const graduations = [min, score.seuilDanger, score.seuilSain, max];

  const description =
    `${score.label} : ${score.valeur}. Zone de danger en dessous de ${score.seuilDanger}, ` +
    `zone saine au-dessus de ${score.seuilSain}.`;

  return (
    <svg
      viewBox={`${CADRE.x} ${CADRE.y} ${CADRE.largeur} ${CADRE.hauteur}`}
      className="w-full max-w-[13rem] h-auto mt-2"
      role="img"
      aria-label={description}
    >
      <path
        d={arc(min, score.seuilDanger, RAYON)}
        fill="none"
        stroke="rgb(var(--critical))"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d={arc(score.seuilDanger, score.seuilSain, RAYON)}
        fill="none"
        stroke="rgb(var(--warning))"
        strokeWidth="6"
      />
      <path
        d={arc(score.seuilSain, max, RAYON)}
        fill="none"
        stroke="rgb(var(--success))"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {graduations.map((valeur, index) => {
        const [x1, y1] = point(valeur, RAYON + 4);
        const [x2, y2] = point(valeur, RAYON + 9);
        const [tx, ty] = point(valeur, RAYON + 16);
        /* Les deux extrêmes sont ancrées par leur bord, pas par leur
         * milieu : un seuil à plusieurs caractères (« -0,01 ») centré en
         * bout d'arc dépasse du cadre et se fait rogner. */
        const ancrage =
          index === 0 ? "start" : index === graduations.length - 1 ? "end" : "middle";
        return (
          <g key={valeur}>
            <line
              x1={x1.toFixed(2)}
              y1={y1.toFixed(2)}
              x2={x2.toFixed(2)}
              y2={y2.toFixed(2)}
              stroke="rgb(var(--ink) / 0.35)"
              strokeWidth="1"
            />
            <text
              x={tx.toFixed(2)}
              y={(ty + 3).toFixed(2)}
              textAnchor={ancrage}
              fontSize="7.5"
              fill="rgb(var(--ink) / 0.45)"
            >
              {graduationLisible(valeur, etendue)}
            </text>
          </g>
        );
      })}

      <line
        x1={CENTRE_X}
        y1={CENTRE_Y}
        x2={aiguilleX.toFixed(2)}
        y2={aiguilleY.toFixed(2)}
        stroke="rgb(var(--ink))"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx={CENTRE_X} cy={CENTRE_Y} r="3.5" fill="rgb(var(--ink))" />

      <text
        x={CENTRE_X}
        y={CENTRE_Y + 24}
        textAnchor="middle"
        fontSize="18"
        fontWeight="600"
        fill="rgb(var(--ink))"
        className="font-mono"
      >
        {score.valeur.toLocaleString("fr-FR", { maximumFractionDigits: 4 })}
      </text>
    </svg>
  );
}
