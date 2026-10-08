import { Link } from "react-router";
import { AlertTriangle, ArrowRight, CircleCheck, OctagonAlert } from "lucide-react";
import type { RatioValue } from "../../api/types";
import { formatRatioValue } from "../../lib/format";
import type { EtatIndicateurs, Verdict } from "../../lib/tableauDeBord";
import { useMonte } from "../../lib/animation";

const VERDICTS: Record<Verdict, { titre: string; phrase: string; Icone: typeof CircleCheck; classe: string }> = {
  sain: {
    titre: "Situation saine",
    phrase: "Les indicateurs sont, pour l'essentiel, dans les normes.",
    Icone: CircleCheck,
    classe: "text-success",
  },
  a_surveiller: {
    titre: "Situation à surveiller",
    phrase: "Quelques indicateurs décrochent : les voici, avec où regarder pour comprendre.",
    Icone: AlertTriangle,
    classe: "text-warning",
  },
  fragile: {
    titre: "Situation fragile",
    phrase: "Plusieurs indicateurs sont en zone critique : ce sont eux à traiter en premier.",
    Icone: OctagonAlert,
    classe: "text-critical",
  },
};

/**
 * La première chose qu'on lit : où en est l'entreprise, en une phrase, et ce
 * qui mérite d'être regardé.
 *
 * L'anneau compte les indicateurs par état — vert, à surveiller, critique —
 * et son centre dit combien sont au vert. C'est un décompte, pas une note :
 * chaque indicateur se retrouve plus bas dans sa famille, avec sa valeur.
 */
export function Synthese({
  etat,
  currency,
  ouComprendre,
}: {
  etat: EtatIndicateurs;
  currency: string;
  ouComprendre: Record<string, { to: string; libelle: string }>;
}) {
  const verdict = VERDICTS[etat.verdict];
  const affiches = etat.aSurveiller.slice(0, 4);
  const restants = etat.aSurveiller.length - affiches.length;

  return (
    <section className="card relative overflow-hidden" aria-labelledby="titre-synthese">
      {/* Un halo de la couleur de marque, à peine visible, pour faire de ce
          bloc l'entrée de la page sans l'encadrer davantage. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative grid gap-6 lg:grid-cols-[auto_1fr_1.15fr] lg:items-center">
        <Anneau etat={etat} />

        <div className="min-w-0">
          <div className={`flex items-center gap-2 ${verdict.classe}`}>
            <verdict.Icone size={22} aria-hidden="true" />
            <h2 id="titre-synthese" className="text-xl font-bold text-ink">
              {verdict.titre}
            </h2>
          </div>
          <p className="text-[0.95rem] text-ink-2 mt-2 max-w-md">{verdict.phrase}</p>
          <ul className="flex flex-wrap gap-2 mt-4 text-sm">
            <Pastille classe="bg-success-soft text-success" Icone={CircleCheck} n={etat.bon} libelle="au vert" />
            <Pastille classe="bg-warning-soft text-warning" Icone={AlertTriangle} n={etat.attention} libelle="à surveiller" />
            <Pastille classe="bg-critical-soft text-critical" Icone={OctagonAlert} n={etat.critique} libelle="critique" pluriel="critiques" />
          </ul>
        </div>

        <div className="min-w-0 lg:border-l lg:border-rule/10 lg:pl-6">
          <h3 className="text-sm font-semibold text-ink-2 mb-2">Points d&apos;attention</h3>
          {affiches.length === 0 ? (
            <p className="text-sm text-ink-3">Aucun indicateur ne décroche sur cette période.</p>
          ) : (
            <ul className="space-y-2.5">
              {affiches.map((ratio) => (
                <PointAttention key={ratio.id} ratio={ratio} currency={currency} lien={ouComprendre[ratio.id]} />
              ))}
            </ul>
          )}
          {restants > 0 && (
            <a href="#indicateurs" className="inline-block mt-3 text-sm font-medium text-primary hover:underline">
              Et {restants} autre{restants > 1 ? "s" : ""}, dans le détail des indicateurs
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function Pastille({
  classe,
  Icone,
  n,
  libelle,
  pluriel,
}: {
  classe: string;
  Icone: typeof CircleCheck;
  n: number;
  libelle: string;
  pluriel?: string;
}) {
  return (
    <li className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${classe}`}>
      <Icone size={14} aria-hidden="true" />
      {n} {n > 1 && pluriel ? pluriel : libelle}
    </li>
  );
}

function PointAttention({
  ratio,
  currency,
  lien,
}: {
  ratio: RatioValue;
  currency: string;
  lien?: { to: string; libelle: string };
}) {
  const critique = ratio.status === "critique";
  const Icone = critique ? OctagonAlert : AlertTriangle;
  return (
    <li className="flex items-start gap-2.5">
      <Icone size={16} className={`flex-none mt-0.5 ${critique ? "text-critical" : "text-warning"}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold truncate">{ratio.label}</span>
          <span className="text-sm font-semibold tabular-nums flex-none">
            {formatRatioValue(ratio.value, ratio.unit, currency)}
          </span>
        </div>
        <p className="text-xs text-ink-3 line-clamp-2">{ratio.interpretation}</p>
        {lien && (
          <Link to={lien.to} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-0.5">
            {lien.libelle}
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        )}
      </div>
    </li>
  );
}

/**
 * L'anneau des états. Trois arcs séparés d'un filet de fond, qui se
 * dessinent à l'ouverture ; le centre porte le seul chiffre qu'on retient.
 */
function Anneau({ etat }: { etat: EtatIndicateurs }) {
  const monte = useMonte();
  const taille = 148;
  const epaisseur = 13;
  const rayon = (taille - epaisseur) / 2;
  const circonference = 2 * Math.PI * rayon;
  const ecartArc = etat.total > 1 ? 4 : 0;

  const parts = [
    { n: etat.bon, classe: "stroke-success" },
    { n: etat.attention, classe: "stroke-warning" },
    { n: etat.critique, classe: "stroke-critical" },
  ].filter((p) => p.n > 0);

  let depart = 0;
  const arcs = parts.map((p) => {
    const longueur = (p.n / Math.max(etat.total, 1)) * circonference;
    const arc = { ...p, longueur: Math.max(longueur - ecartArc, 0), depart };
    depart += longueur;
    return arc;
  });

  return (
    <div
      className="relative mx-auto flex-none"
      style={{ width: taille, height: taille }}
      role="img"
      aria-label={`${etat.bon} indicateurs au vert sur ${etat.total}, ${etat.attention} à surveiller, ${etat.critique} critiques`}
    >
      <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} className="-rotate-90">
        <circle cx={taille / 2} cy={taille / 2} r={rayon} fill="none" strokeWidth={epaisseur} className="stroke-ink/[0.07]" />
        {arcs.map((arc) => (
          <circle
            key={arc.classe}
            cx={taille / 2}
            cy={taille / 2}
            r={rayon}
            fill="none"
            strokeWidth={epaisseur}
            strokeLinecap="butt"
            className={`${arc.classe} transition-[stroke-dasharray] duration-700 ease-out`}
            strokeDasharray={`${monte ? arc.longueur : 0} ${circonference}`}
            strokeDashoffset={-arc.depart}
          />
        ))}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <div className="text-[2.1rem] font-bold leading-none tracking-tight">
          {etat.bon}
          <span className="text-lg font-semibold text-ink-3">/{etat.total}</span>
        </div>
        <div className="text-xs font-medium text-ink-3 mt-1">au vert</div>
      </div>
    </div>
  );
}
