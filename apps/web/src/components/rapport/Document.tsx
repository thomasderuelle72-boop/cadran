import type { ReactNode } from "react";
import type {
  ActionPlan,
  ActionStatus,
  BilanValeur,
  Opportunite,
  Previsionnel,
  RatioResultPayload,
  SerieExercice,
  SigPayload,
} from "../../api/types";
import { formatCurrency, formatRatioValue } from "../../lib/format";
import { montantCourt, pourcentSigne, valeur, variation, type Lecture } from "../../lib/evolution";
import { ecart, etatIndicateurs } from "../../lib/tableauDeBord";
import { SECTIONS, remplir, type IdSection, type ModeleRapport, type Variables } from "../../lib/rapport";
import { ENJEUX } from "../opportunites/CarteOpportunite";
import { Colonnes } from "../evolution/Colonnes";

/**
 * Le rapport client, tel qu'il sera imprimé.
 *
 * Une feuille blanche quel que soit le thème de l'écran (classe `papier`),
 * la couleur du cabinet sur les titres et les filets, et des sections qui ne
 * se coupent pas en bas de page quand elles tiennent sur une seule. Chaque
 * chiffre vient de Cadran ; seuls les textes viennent du cabinet.
 */

export interface ContenuRapport {
  modele: ModeleRapport;
  variables: Variables;
  devise: string;
  accent: string;
  logo: string | null;
  signature: string | null;
  signataire: { nom: string | null; fonction: string | null };
  mentions: string | null;
  ratios: RatioResultPayload | null;
  ratiosPrecedents: RatioResultPayload | null;
  libellePrecedent: string | null;
  sig: SigPayload | null;
  exercices: SerieExercice[];
  lectures: Lecture[];
  missions: Opportunite[];
  actions: ActionPlan[];
  valeur: BilanValeur | null;
  previsionnel: Previsionnel | null;
}

const VERDICTS = {
  sain: "Situation saine",
  a_surveiller: "Situation à surveiller",
  fragile: "Situation fragile",
} as const;

const ETATS_LECTURE = { sain: "Sain", a_surveiller: "À surveiller", fragile: "Fragile" } as const;
const STATUTS: Record<ActionStatus, string> = {
  A_FAIRE: "À faire",
  EN_COURS: "En cours",
  FAITE: "Faite",
  ABANDONNEE: "Abandonnée",
};
const STATUTS_RATIO = { bon: "Bon", attention: "À surveiller", critique: "Critique", neutre: "" } as const;

/** « Marge d'EBITDA » devient « marge d'EBITDA » : seule la première lettre, pour ne pas écraser les sigles. */
function premiereMinuscule(texte: string): string {
  return texte.charAt(0).toLocaleLowerCase("fr") + texte.slice(1);
}

export function DocumentRapport({ contenu }: { contenu: ContenuRapport }) {
  const { modele, accent } = contenu;
  const sections = modele.sections.filter((id) => id !== "garde");
  return (
    <article className="papier font-sans text-[10.5pt] leading-relaxed">
      {modele.sections.includes("garde") && <PageDeGarde contenu={contenu} />}
      <div className="space-y-8">
        {sections.map((id) => (
          <Section key={id} id={id} accent={accent}>
            <Corps id={id} contenu={contenu} />
          </Section>
        ))}
      </div>
      {contenu.mentions && (
        <p className="mt-10 pt-3 border-t text-[8.5pt] text-ink-3 whitespace-pre-line" style={{ borderColor: accent }}>
          {contenu.mentions}
        </p>
      )}
    </article>
  );
}

function PageDeGarde({ contenu }: { contenu: ContenuRapport }) {
  const { modele, variables, accent, logo } = contenu;
  return (
    <header className="flex min-h-[24cm] flex-col justify-between pb-10 mb-10" style={{ breakAfter: "page" }}>
      <div className="flex items-start justify-between gap-6">
        {logo ? <img src={logo} alt={`Logo ${variables.cabinet}`} className="max-h-20 max-w-[50%] object-contain" /> : <span />}
        <span className="text-right text-[9.5pt] text-ink-3">{variables.cabinet}</span>
      </div>
      <div>
        <div className="h-1 w-16 mb-6" style={{ background: accent }} />
        <h1 className="text-[26pt] font-bold leading-tight" style={{ color: accent }}>
          {remplir(modele.titre, variables)}
        </h1>
        <p className="mt-4 text-[15pt] font-semibold">{variables.dossier}</p>
        <p className="text-[11pt] text-ink-2">{variables.exercice}</p>
      </div>
      <p className="text-[10pt] text-ink-3">Remis le {variables.date}</p>
    </header>
  );
}

function Section({ id, accent, children }: { id: IdSection; accent: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`rapport-${id}`}>
      <h2 id={`rapport-${id}`} className="text-[14pt] font-bold pb-1.5 mb-3 border-b-2" style={{ color: accent, borderColor: accent }}>
        {SECTIONS[id].libelle}
      </h2>
      {children}
    </section>
  );
}

function Vide({ children }: { children: ReactNode }) {
  return <p className="text-ink-3 italic">{children}</p>;
}

function Corps({ id, contenu }: { id: IdSection; contenu: ContenuRapport }) {
  const { variables, devise } = contenu;
  switch (id) {
    case "mot":
      return <p className="whitespace-pre-line">{remplir(contenu.modele.mot, variables)}</p>;
    case "synthese":
      return <Synthese contenu={contenu} />;
    case "evolution":
      return <Evolution contenu={contenu} />;
    case "resultat": {
      const soldes = contenu.sig?.sig.soldes.filter((s) => s.majeur) ?? [];
      if (soldes.length === 0) return <Vide>Les soldes de gestion ne sont pas disponibles pour cette période.</Vide>;
      return (
        <table className="w-full insecable">
          <thead>
            <tr className="text-left text-[8.5pt] uppercase tracking-wide text-ink-3 border-b border-rule/20">
              <th className="py-1.5 font-semibold">Solde</th>
              <th className="py-1.5 font-semibold text-right">Montant</th>
              <th className="py-1.5 font-semibold text-right">% du chiffre d&apos;affaires</th>
            </tr>
          </thead>
          <tbody>
            {soldes.map((s) => (
              <tr key={s.id} className="border-b border-rule/10">
                <td className="py-1.5">{s.label}</td>
                <td className={`py-1.5 text-right tabular-nums ${s.valeur < 0 ? "text-critical" : ""}`}>{formatCurrency(s.valeur, devise)}</td>
                <td className="py-1.5 text-right tabular-nums text-ink-2">{formatRatioValue(s.partDuCa, "pourcentage")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "bilan":
      return <Bilan contenu={contenu} />;
    case "indicateurs": {
      const ratios = contenu.ratios?.ratios.filter((r) => r.status !== "neutre" && r.value !== null) ?? [];
      if (ratios.length === 0) return <Vide>Aucun indicateur disponible pour cette période.</Vide>;
      return (
        <table className="w-full">
          <tbody>
            {ratios.map((r) => (
              <tr key={r.id} className="border-b border-rule/10 insecable">
                <td className="py-1.5">{r.label}</td>
                <td className="py-1.5 text-right tabular-nums">{formatRatioValue(r.value, r.unit, devise)}</td>
                <td
                  className={`py-1.5 pl-4 text-right text-[9pt] font-semibold ${
                    r.status === "bon" ? "text-success" : r.status === "critique" ? "text-critical" : "text-warning"
                  }`}
                >
                  {STATUTS_RATIO[r.status]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "missions":
      if (contenu.missions.length === 0) return <Vide>Aucune recommandation particulière sur cet exercice.</Vide>;
      return (
        <div className="space-y-4">
          {contenu.missions.map((m) => (
            <div key={m.type} className="insecable">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-semibold">{m.mission}</h3>
                {m.enjeu > 0 && (
                  <span className="whitespace-nowrap text-[9.5pt] font-semibold">
                    ≈ {formatCurrency(Math.round(m.enjeu), devise)} {ENJEUX[m.natureEnjeu]}
                  </span>
                )}
              </div>
              <p className="text-ink-2">{m.constat}</p>
              <p>
                <span className="font-semibold">Ce que nous proposons : </span>
                {m.action}
              </p>
            </div>
          ))}
        </div>
      );
    case "plan": {
      const actions = contenu.actions.filter((a) => a.statut !== "ABANDONNEE");
      if (actions.length === 0) return <Vide>Aucune action n&apos;est inscrite au plan pour ce dossier.</Vide>;
      return (
        <table className="w-full">
          <thead>
            <tr className="text-left text-[8.5pt] uppercase tracking-wide text-ink-3 border-b border-rule/20">
              <th className="py-1.5 font-semibold">Action</th>
              <th className="py-1.5 font-semibold">Échéance</th>
              <th className="py-1.5 font-semibold text-right">Statut</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a.id} className="border-b border-rule/10 align-top insecable">
                <td className="py-1.5 pr-4">
                  {a.action}
                  {a.responsable && <span className="block text-[9pt] text-ink-3">Responsable : {a.responsable}</span>}
                </td>
                <td className="py-1.5 whitespace-nowrap text-ink-2">
                  {a.echeance ? new Date(a.echeance).toLocaleDateString("fr-FR") : "—"}
                </td>
                <td className="py-1.5 text-right whitespace-nowrap font-semibold">{STATUTS[a.statut]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "valeur": {
      const lignes = contenu.valeur?.lignes.filter((l) => !l.exclue && l.gainRetenu !== null) ?? [];
      if (lignes.length === 0) return <Vide>Aucun gain mesuré pour l&apos;instant sur les actions de ce dossier.</Vide>;
      return (
        <div className="space-y-3">
          <table className="w-full">
            <tbody>
              {lignes.map((l) => (
                <tr key={l.actionId} className="border-b border-rule/10 align-top insecable">
                  <td className="py-1.5 pr-4">
                    {l.action}
                    <span className="block text-[9pt] text-ink-3">{l.explication}</span>
                  </td>
                  <td className={`py-1.5 text-right tabular-nums whitespace-nowrap font-semibold ${(l.gainRetenu ?? 0) < 0 ? "text-critical" : ""}`}>
                    {formatCurrency(Math.round(l.gainRetenu ?? 0), devise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {contenu.valeur && (
            <p className="font-semibold">
              {[
                contenu.valeur.totaux.tresorerie ? `${formatCurrency(Math.round(contenu.valeur.totaux.tresorerie), devise)} de trésorerie libérée` : null,
                contenu.valeur.totaux.resultat ? `${formatCurrency(Math.round(contenu.valeur.totaux.resultat), devise)} de résultat en plus par an` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      );
    }
    case "previsionnel":
      return <PrevisionnelResume contenu={contenu} />;
    case "conclusion":
      return <Conclusion contenu={contenu} />;
    default:
      return null;
  }
}

function Synthese({ contenu }: { contenu: ContenuRapport }) {
  const { ratios, ratiosPrecedents, libellePrecedent } = contenu;
  if (!ratios) return <Vide>Aucune période importée pour ce dossier.</Vide>;
  const etat = etatIndicateurs(ratios.ratios);
  const chiffres = [
    { libelle: "Chiffre d'affaires", v: ratios.aggregates.chiffreAffaires, p: ratiosPrecedents?.aggregates.chiffreAffaires },
    { libelle: "EBITDA", v: ratios.derived.ebitda, p: ratiosPrecedents?.derived.ebitda },
    { libelle: "Résultat net", v: ratios.derived.resultatNet, p: ratiosPrecedents?.derived.resultatNet },
    { libelle: "Trésorerie nette", v: ratios.derived.tresorerieNette, p: ratiosPrecedents?.derived.tresorerieNette },
  ];
  return (
    <div className="space-y-4">
      <p>
        <span className="font-bold">{VERDICTS[etat.verdict]}.</span>{" "}
        {etat.bon} indicateur{etat.bon > 1 ? "s" : ""} au vert sur {etat.total}
        {etat.critique > 0 ? `, ${etat.critique} en zone critique` : ""}
        {etat.aSurveiller.length > 0 ? ` : ${etat.aSurveiller.slice(0, 3).map((r) => premiereMinuscule(r.label)).join(", ")}` : ""}.
      </p>
      <div className="grid grid-cols-4 gap-3 insecable">
        {chiffres.map((c) => {
          const e = ecart(c.v, c.p);
          return (
            <div key={c.libelle} className="rounded-md bg-surface-2 px-3 py-2">
              <div className="text-[8.5pt] text-ink-3">{c.libelle}</div>
              <div className={`text-[13pt] font-bold tabular-nums ${c.v < 0 ? "text-critical" : ""}`}>{montantCourt(c.v)}</div>
              {e && libellePrecedent && (
                <div className="text-[8.5pt] text-ink-2">
                  {e.pourcentage !== null ? pourcentSigne(e.pourcentage) : `${e.absolu >= 0 ? "+" : "−"}${montantCourt(Math.abs(e.absolu))}`} vs{" "}
                  {libellePrecedent}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Evolution({ contenu }: { contenu: ContenuRapport }) {
  const { exercices, lectures } = contenu;
  if (exercices.length < 2 || lectures.length === 0) {
    return <Vide>Il faut au moins deux exercices complets pour lire une évolution.</Vide>;
  }
  return (
    <div className="space-y-4">
      <div className="insecable">
        <div className="text-[9pt] text-ink-3 mb-1">Chiffre d&apos;affaires par exercice</div>
        <Colonnes
          hauteur={110}
          colonnes={exercices.map((e, i) => {
            const ca = valeur(e, "agregat.chiffreAffaires");
            const avant = i > 0 ? valeur(exercices[i - 1], "agregat.chiffreAffaires") : null;
            return { libelle: e.label, valeur: ca, variation: ca !== null && avant !== null ? variation(avant, ca).taux : null };
          })}
        />
      </div>
      {lectures.map((l) => (
        <div key={l.theme} className="insecable">
          <h3 className="font-semibold">
            {l.question}{" "}
            <span
              className={`text-[9pt] ${l.etat === "sain" ? "text-success" : l.etat === "fragile" ? "text-critical" : "text-warning"}`}
            >
              — {ETATS_LECTURE[l.etat]}, {l.resume}
            </span>
          </h3>
          {l.phrases.map((p) => (
            <p key={p} className="text-ink-2">
              {p}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function Bilan({ contenu }: { contenu: ContenuRapport }) {
  const { ratios, devise } = contenu;
  if (!ratios) return <Vide>Aucune période importée pour ce dossier.</Vide>;
  const d = ratios.derived;
  const ratio = (id: string) => ratios.ratios.find((r) => r.id === id)?.value ?? null;
  return (
    <div className="space-y-3 insecable">
      <p>
        Le fonds de roulement s&apos;élève à <strong>{formatCurrency(d.fondsDeRoulement, devise)}</strong> et le besoin en fonds de
        roulement à <strong>{formatCurrency(d.bfr, devise)}</strong> : la trésorerie nette ressort à{" "}
        <strong className={d.tresorerieNette < 0 ? "text-critical" : ""}>{formatCurrency(d.tresorerieNette, devise)}</strong>.
      </p>
      <table className="w-full">
        <tbody>
          {[
            ["Délai de paiement des clients", ratio("dso")],
            ["Délai de paiement des fournisseurs", ratio("dpo")],
            ["Durée de stockage", ratio("dio")],
          ].map(([libelle, v]) => (
            <tr key={libelle as string} className="border-b border-rule/10">
              <td className="py-1.5">{libelle}</td>
              <td className="py-1.5 text-right tabular-nums">{formatRatioValue(v as number | null, "jours")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrevisionnelResume({ contenu }: { contenu: ContenuRapport }) {
  const prev = contenu.previsionnel;
  if (!prev || prev.plan.length === 0) return <Vide>Le prévisionnel demande au moins un exercice complet.</Vide>;
  const manques = prev.plan.filter((l) => l.tresorerieFin < 0);
  const pire = manques.reduce<(typeof manques)[number] | null>((a, b) => (a === null || b.tresorerieFin < a.tresorerieFin ? b : a), null);
  return (
    <div className="space-y-3 insecable">
      <p>
        {pire
          ? `Avec les hypothèses retenues, la trésorerie deviendrait négative : il manquerait ${formatCurrency(-pire.tresorerieFin, contenu.devise)} en ${pire.annee}. Un financement ou une réduction du besoin en fonds de roulement est à préparer.`
          : `Avec les hypothèses retenues, la trésorerie reste positive sur les ${prev.plan.length} exercices projetés.`}
      </p>
      <table className="w-full">
        <thead>
          <tr className="text-left text-[8.5pt] uppercase tracking-wide text-ink-3 border-b border-rule/20">
            <th className="py-1.5 font-semibold">Exercice prévisionnel</th>
            <th className="py-1.5 font-semibold text-right">Chiffre d&apos;affaires</th>
            <th className="py-1.5 font-semibold text-right">Résultat net</th>
            <th className="py-1.5 font-semibold text-right">Trésorerie de fin</th>
          </tr>
        </thead>
        <tbody>
          {prev.exercices.map((e, i) => (
            <tr key={e.annee} className="border-b border-rule/10">
              <td className="py-1.5">{e.label}</td>
              <td className="py-1.5 text-right tabular-nums">{formatCurrency(valeur(e, "agregat.chiffreAffaires") ?? 0, contenu.devise)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatCurrency(valeur(e, "derive.resultatNet") ?? 0, contenu.devise)}</td>
              <td className={`py-1.5 text-right tabular-nums font-semibold ${(prev.plan[i]?.tresorerieFin ?? 0) < 0 ? "text-critical" : ""}`}>
                {formatCurrency(prev.plan[i]?.tresorerieFin ?? 0, contenu.devise)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Conclusion({ contenu }: { contenu: ContenuRapport }) {
  const { modele, variables, signature, signataire } = contenu;
  return (
    <div className="space-y-8">
      <p className="whitespace-pre-line">{remplir(modele.conclusion, variables)}</p>
      <div className="insecable flex justify-end">
        <div className="text-right space-y-1">
          <p className="text-ink-2">Le {variables.date},</p>
          {signature && <img src={signature} alt="Signature" className="ml-auto max-h-20 object-contain" />}
          {signataire.nom && <p className="font-semibold">{signataire.nom}</p>}
          {signataire.fonction && <p className="text-ink-2">{signataire.fonction}</p>}
          <p className="text-ink-2">{variables.cabinet}</p>
        </div>
      </div>
    </div>
  );
}
