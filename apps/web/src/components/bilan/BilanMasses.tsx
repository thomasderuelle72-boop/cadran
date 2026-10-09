import type { Aggregates } from "../../api/types";
import { formatCurrency } from "../../lib/format";
import { montantCourt } from "../../lib/evolution";
import { useMonte } from "../../lib/animation";

interface Masse {
  libelle: string;
  valeur: number;
  /** Le rôle de la masse dans le bilan fonctionnel : stable, circulant, trésorerie. */
  role: "stable" | "circulant" | "tresorerie";
  detail?: string;
}

const TEINTES: Record<Masse["role"], { fond: string; trait: string }> = {
  stable: { fond: "bg-serie-1/20", trait: "border-serie-1" },
  circulant: { fond: "bg-serie-2/20", trait: "border-serie-2" },
  tresorerie: { fond: "bg-serie-3/20", trait: "border-serie-3" },
};

/**
 * Le bilan en grandes masses, comme on le dessine au tableau.
 *
 * Deux barres à la même échelle : en haut ce que l'entreprise possède, en bas
 * comment elle le finance. Les masses sont rangées par rôle — stable, cycle
 * d'exploitation, trésorerie — et chaque rôle garde sa teinte d'une barre à
 * l'autre. Le fonds de roulement se voit alors sans calcul : c'est ce que les
 * ressources stables financent au-delà des immobilisations, l'accolade sous
 * la seconde barre.
 *
 * Teintes claires et texte à l'encre : le libellé se lit dans la barre, dans
 * les deux thèmes, et le filet de couleur pleine garde l'identité de la masse.
 */
export function BilanMasses({ a, currency }: { a: Aggregates; currency: string }) {
  const monte = useMonte();
  const actif: Masse[] = [
    { libelle: "Immobilisations", valeur: a.immobilisations, role: "stable" },
    {
      libelle: "Stocks et créances",
      valeur: a.stocks + a.creancesClients + a.autresCreances,
      role: "circulant",
      detail: `Stocks ${montantCourt(a.stocks)} · clients ${montantCourt(a.creancesClients)} · autres ${montantCourt(a.autresCreances)}`,
    },
    { libelle: "Disponibilités", valeur: a.disponibilites, role: "tresorerie" },
  ];
  const passif: Masse[] = [
    { libelle: "Capitaux propres", valeur: a.capitauxPropres, role: "stable" },
    { libelle: "Dettes financières", valeur: a.dettesFinancieres, role: "stable" },
    {
      libelle: "Fournisseurs et autres dettes",
      valeur: a.dettesFournisseurs + a.autresDettes,
      role: "circulant",
      detail: `Fournisseurs ${montantCourt(a.dettesFournisseurs)} · autres ${montantCourt(a.autresDettes)}`,
    },
  ];
  const total = (masses: Masse[]) => masses.reduce((s, m) => s + Math.max(0, m.valeur), 0);
  const echelle = Math.max(total(actif), total(passif), 1);
  const position = (v: number) => (Math.max(0, v) / echelle) * 100;

  const ressourcesStables = Math.max(0, a.capitauxPropres) + Math.max(0, a.dettesFinancieres);
  const emploisStables = Math.max(0, a.immobilisations);
  const fondsDeRoulement = ressourcesStables - emploisStables;
  const negatives = [...actif, ...passif].filter((m) => m.valeur < 0);

  const barre = (masses: Masse[]) => (
    <div className="flex h-16 gap-[2px] transition-[width] duration-700 ease-out" style={{ width: monte ? `${position(total(masses))}%` : "0%" }}>
      {masses
        .filter((m) => m.valeur > 0)
        .map((m) => (
          <div
            key={m.libelle}
            className={`${TEINTES[m.role].fond} ${TEINTES[m.role].trait} border-l-[3px] rounded-[3px] px-2 py-1.5 min-w-0 overflow-hidden`}
            style={{ width: `${(m.valeur / total(masses)) * 100}%` }}
            title={`${m.libelle} : ${formatCurrency(m.valeur, currency)}${m.detail ? ` (${m.detail})` : ""}`}
          >
            <div className="text-xs font-semibold truncate">{m.libelle}</div>
            <div className="text-xs tabular-nums text-ink-2 truncate">{montantCourt(m.valeur)}</div>
          </div>
        ))}
    </div>
  );

  return (
    <figure className="space-y-2">
      <div className="relative pb-10">
        <div className="text-xs font-semibold text-ink-3 mb-1">Ce que l&apos;entreprise possède</div>
        {barre(actif)}
        <div className="text-xs font-semibold text-ink-3 mt-3 mb-1">Comment elle le finance</div>
        {barre(passif)}

        {/* Le fonds de roulement : des immobilisations aux ressources stables. */}
        {emploisStables > 0 && (
          <>
            <span
              className="absolute top-5 bottom-8 border-l-2 border-dashed border-ink/35"
              style={{ left: `${position(emploisStables)}%` }}
              aria-hidden="true"
            />
            <div
              className={`absolute bottom-0 h-7 border-t-2 ${fondsDeRoulement >= 0 ? "border-serie-1" : "border-critical"}`}
              style={{
                left: `${position(Math.min(emploisStables, ressourcesStables))}%`,
                width: `${Math.abs(position(ressourcesStables) - position(emploisStables))}%`,
              }}
            >
              <span
                className={`absolute left-1/2 -translate-x-1/2 top-1 whitespace-nowrap text-xs font-semibold ${
                  fondsDeRoulement >= 0 ? "" : "text-critical"
                }`}
              >
                Fonds de roulement {fondsDeRoulement >= 0 ? "" : "négatif "}: {montantCourt(fondsDeRoulement)}
              </span>
            </div>
          </>
        )}
      </div>
      <figcaption className="text-xs text-ink-3 max-w-prose">
        Teinte verte : le long terme (immobilisations d&apos;un côté, capitaux propres et emprunts de l&apos;autre).
        Teinte ocre : le cycle d&apos;exploitation. Teinte bleue : la trésorerie. Survolez une masse pour son détail.
        {negatives.length > 0 &&
          ` ${negatives.map((m) => `${m.libelle} négatifs (${montantCourt(m.valeur)})`).join(", ")} : non représentés dans les barres.`}
      </figcaption>
    </figure>
  );
}
