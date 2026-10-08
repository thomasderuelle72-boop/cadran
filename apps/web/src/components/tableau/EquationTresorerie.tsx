import { CircleCheck, OctagonAlert } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import { useMonte } from "../../lib/animation";

/**
 * D'où vient la trésorerie, posé comme une soustraction.
 *
 * Fonds de roulement − besoin en fonds de roulement = trésorerie nette : la
 * relation qu'un expert-comptable dessine au tableau pour l'expliquer, et
 * qu'aucune liste de ratios ne fait voir. Chaque terme a sa phrase, et une
 * barre à la même échelle que les deux autres pour juger des ordres de
 * grandeur sans lire les chiffres.
 */
export function EquationTresorerie({
  fondsDeRoulement,
  bfr,
  tresorerie,
  currency,
}: {
  fondsDeRoulement: number;
  bfr: number;
  tresorerie: number;
  currency: string;
}) {
  const monte = useMonte();
  const echelle = Math.max(Math.abs(fondsDeRoulement), Math.abs(bfr), Math.abs(tresorerie), 1);
  const positive = tresorerie >= 0;

  const termes = [
    {
      libelle: "Fonds de roulement",
      valeur: fondsDeRoulement,
      phrase: "Ce que les capitaux et les emprunts financent au-delà des investissements.",
      barre: "bg-serie-1",
    },
    {
      libelle: "Besoin en fonds de roulement",
      valeur: bfr,
      phrase: "L'argent bloqué dans les stocks et les factures clients, moins ce qu'on doit aux fournisseurs.",
      barre: "bg-serie-2",
    },
  ];

  return (
    <div className="space-y-3">
      {termes.map((t, i) => (
        <div key={t.libelle}>
          {i === 1 && <Operateur signe="−" />}
          <Terme {...t} echelle={echelle} monte={monte} currency={currency} />
        </div>
      ))}
      <Operateur signe="=" />
      <div className={`rounded-xl p-3.5 ${positive ? "bg-success-soft" : "bg-critical-soft"}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Trésorerie nette</span>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${positive ? "text-success" : "text-critical"}`}>
            {positive ? <CircleCheck size={14} aria-hidden="true" /> : <OctagonAlert size={14} aria-hidden="true" />}
            {positive ? "Positive" : "Négative"}
          </span>
        </div>
        <div className="text-2xl font-bold tracking-tight mt-1">{formatCurrency(tresorerie, currency)}</div>
        <p className="text-xs text-ink-2 mt-1">
          {positive
            ? "Les ressources stables couvrent le cycle d'exploitation, avec un excédent disponible."
            : "Le cycle d'exploitation consomme plus que les ressources stables : l'écart est financé à court terme."}
        </p>
      </div>
    </div>
  );
}

/** Le signe de l'opération, centré sur un filet : il relie les termes. */
function Operateur({ signe }: { signe: string }) {
  return (
    <div className="flex items-center gap-3 my-1" aria-hidden="true">
      <span className="h-px flex-1 bg-rule/10" />
      <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-base font-bold text-ink-2">{signe}</span>
      <span className="h-px flex-1 bg-rule/10" />
    </div>
  );
}

function Terme({
  libelle,
  valeur,
  phrase,
  barre,
  echelle,
  monte,
  currency,
}: {
  libelle: string;
  valeur: number;
  phrase: string;
  barre: string;
  echelle: number;
  monte: boolean;
  currency: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{libelle}</span>
        <span className="text-base font-bold tabular-nums">{formatCurrency(valeur, currency)}</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-ink/[0.06] overflow-hidden" aria-hidden="true">
        <div
          className={`h-full rounded-full ${barre} transition-[width] duration-700 ease-out`}
          style={{ width: monte ? `${(Math.abs(valeur) / echelle) * 100}%` : 0 }}
        />
      </div>
      <p className="text-xs text-ink-3 mt-1">{phrase}</p>
    </div>
  );
}
