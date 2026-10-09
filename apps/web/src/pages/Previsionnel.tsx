import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CircleCheck, RotateCcw } from "lucide-react";
import { ApiError } from "../api/client";
import { useEffacerHypotheses, useEnregistrerHypotheses, useEntities, usePrevisionnel } from "../api/hooks";
import type { Hypotheses, LignePlan, Previsionnel, ResumeScenario, SerieExercice } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { EntetePage, EtatVide, SqueletteCarte, Zone } from "../components/etats";
import { Colonnes, HACHURE, LegendeScenarios } from "../components/evolution/Colonnes";
import { useDossierCourant } from "../lib/dossierCourant";
import { montantCourt, pourcentSigne, valeur } from "../lib/evolution";
import { formatCurrency } from "../lib/format";

/**
 * Le prévisionnel : où va l'entreprise, et faut-il financer ?
 *
 * À gauche les hypothèses, à droite ce qu'elles produisent, recalculé à
 * chaque saisie — c'est un simulateur, il doit répondre tout de suite.
 *
 * Trois partis pris, tirés de ce qu'attend un banquier (Bpifrance Création) :
 * - on part des chiffres du client, et chaque hypothèse montre la valeur
 *   constatée à côté : un écart est une décision, pas un réglage oublié ;
 * - les résultats sont présentés comme les banques les lisent : compte de
 *   résultat prévisionnel, plan de financement, trésorerie de fin d'année ;
 * - le projeté ne se déguise jamais en réalisé : il est hachuré (notation
 *   IBCS) et ses colonnes portent « prév. ».
 */

type Unite = "%" | "j" | "€" | "ans";

interface Champ {
  cle: keyof Hypotheses;
  libelle: string;
  unite: Unite;
  pas: number;
  aide?: string;
  /** Comment dire la valeur constatée : « 2025 : 55 j ». */
  reference?: (v: number) => string;
}

const enPourcent = (v: number) => `${(Math.round(v * 1000) / 10).toLocaleString("fr-FR")} %`;
const enJours = (v: number) => `${Math.round(v)} j`;

const GROUPES: Array<{ titre: string; champs: Champ[] }> = [
  {
    titre: "Activité",
    champs: [
      { cle: "croissanceCa", libelle: "Croissance du chiffre d'affaires", unite: "%", pas: 0.5, aide: "par an", reference: (v) => `${pourcentSigne(v)} sur le dernier exercice` },
      { cle: "horizon", libelle: "Horizon", unite: "ans", pas: 1 },
    ],
  },
  {
    titre: "Charges",
    champs: [
      { cle: "partAchats", libelle: "Achats consommés", unite: "%", pas: 0.5, aide: "du chiffre d'affaires", reference: enPourcent },
      { cle: "partImpotsTaxes", libelle: "Impôts et taxes", unite: "%", pas: 0.1, aide: "du chiffre d'affaires", reference: enPourcent },
      { cle: "croissanceChargesExternes", libelle: "Charges externes", unite: "%", pas: 0.5, aide: "de hausse par an", reference: (v) => `${pourcentSigne(v)} sur le dernier exercice` },
      { cle: "croissanceChargesPersonnel", libelle: "Charges de personnel", unite: "%", pas: 0.5, aide: "de hausse par an", reference: (v) => `${pourcentSigne(v)} sur le dernier exercice` },
    ],
  },
  {
    titre: "Besoin en fonds de roulement",
    champs: [
      { cle: "dso", libelle: "Délai de paiement des clients", unite: "j", pas: 1, reference: enJours },
      { cle: "dpo", libelle: "Délai de paiement des fournisseurs", unite: "j", pas: 1, reference: enJours },
      { cle: "dio", libelle: "Durée de stockage", unite: "j", pas: 1, reference: enJours },
    ],
  },
  {
    titre: "Investissements et financement",
    champs: [
      { cle: "investissements", libelle: "Investissements", unite: "€", pas: 1000, aide: "par an", reference: (v) => `amortissements : ${montantCourt(v)}` },
      { cle: "dureeAmortissement", libelle: "Durée d'amortissement", unite: "ans", pas: 1 },
      { cle: "nouveauxEmprunts", libelle: "Nouveaux emprunts", unite: "€", pas: 1000, aide: "par an" },
      { cle: "remboursements", libelle: "Remboursements d'emprunts", unite: "€", pas: 1000, aide: "par an — à vérifier sur le tableau d'emprunt" },
      { cle: "tauxInteret", libelle: "Taux d'intérêt", unite: "%", pas: 0.25, reference: enPourcent },
      { cle: "tauxIS", libelle: "Impôt sur les sociétés", unite: "%", pas: 0.5, aide: "taux normal : 25 %" },
      { cle: "dividendes", libelle: "Dividendes", unite: "€", pas: 1000, aide: "par an" },
    ],
  },
];

/** Les taux se saisissent en pourcentage et se transmettent en fraction. */
const enSaisie = (champ: Champ, v: number) => (champ.unite === "%" ? Math.round(v * 10000) / 100 : v);
const depuisSaisie = (champ: Champ, v: number) => (champ.unite === "%" ? v / 100 : v);

export function PrevisionnelPage() {
  const { user } = useAuth();
  const { data: entites } = useEntities();
  const [entityId] = useDossierCourant(entites);
  const [hypotheses, setHypotheses] = useState<Hypotheses | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // À l'ouverture : les hypothèses enregistrées, ou celles du réel. Ensuite :
  // celles de l'écran, simulées sans être enregistrées.
  const base = usePrevisionnel(entityId || null, null);
  const simulation = usePrevisionnel(entityId || null, hypotheses);
  const donnees = hypotheses ? simulation.data : base.data;

  const dossierAffiche = useRef(entityId);
  useEffect(() => {
    if (dossierAffiche.current === entityId) return;
    dossierAffiche.current = entityId;
    setHypotheses(null);
  }, [entityId]);
  useEffect(() => {
    if (base.data && hypotheses === null) setHypotheses(base.data.hypotheses);
  }, [base.data, hypotheses]);

  const enregistrer = useEnregistrerHypotheses(entityId || null);
  const effacer = useEffacerHypotheses(entityId || null);
  const peutEnregistrer = user?.role === "ADMIN" || user?.role === "DAF" || user?.role === "CONTROLEUR";
  const devise = entites?.find((e) => e.id === entityId)?.currency ?? "EUR";
  const modifie = Boolean(hypotheses && base.data && JSON.stringify(hypotheses) !== JSON.stringify(base.data.hypotheses));

  async function tenter(action: () => Promise<unknown>) {
    setErreur(null);
    try {
      await action();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : "Opération impossible.");
    }
  }

  return (
    <div className="space-y-6">
      <EntetePage
        titre="Prévisionnel"
        sousTitre={
          donnees?.depart
            ? `Les prochains exercices, à partir de ${donnees.depart} — le dernier exercice complet. Sans rien changer, il montre ce qui se passe si rien ne change.`
            : "Les prochains exercices, à partir du dernier exercice complet."
        }
      >
        {peutEnregistrer && hypotheses && (
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={effacer.isPending || (!modifie && !base.data?.enregistre)}
              onClick={() =>
                tenter(async () => {
                  if (base.data?.enregistre) await effacer.mutateAsync();
                  setHypotheses(base.data?.duReel ?? null);
                })
              }
              title="Reprendre les hypothèses tirées du dernier exercice complet"
            >
              <RotateCcw size={15} aria-hidden="true" />
              Repartir du réel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!modifie || enregistrer.isPending}
              onClick={() => tenter(() => enregistrer.mutateAsync(hypotheses))}
            >
              {enregistrer.isPending
                ? "Enregistrement…"
                : modifie
                  ? "Enregistrer les hypothèses"
                  : base.data?.enregistre
                    ? "Hypothèses enregistrées"
                    : "Hypothèses tirées du réel"}
            </button>
          </>
        )}
      </EntetePage>

      {erreur && <p className="text-sm text-critical">{erreur}</p>}

      <Zone
        chargement={base.isLoading}
        erreur={base.error}
        onReessayer={() => void base.refetch()}
        quoi="le prévisionnel"
        squelette={<SqueletteCarte hauteur="24rem" />}
      >
        {donnees && !donnees.depart ? (
          <EtatVide titre="Aucun exercice complet" action={{ to: "/import", label: "Importer des données" }}>
            Le prévisionnel part du dernier exercice complet du dossier : importez un exercice de douze mois.
          </EtatVide>
        ) : (
          donnees &&
          hypotheses && (
            <div className="space-y-6">
              <Verdict donnees={donnees} devise={devise} />
              <Scenarios
                scenarios={donnees.scenarios}
                croissance={hypotheses.croissanceCa}
                surChoix={(croissanceCa) => setHypotheses({ ...hypotheses, croissanceCa })}
              />

              <div className="grid gap-6 xl:grid-cols-[22rem_1fr] items-start">
                <PanneauHypotheses
                  hypotheses={hypotheses}
                  reference={donnees.reference}
                  depart={donnees.depart}
                  devise={devise}
                  surChangement={setHypotheses}
                />
                <div className="space-y-6 min-w-0">
                  <section className="card">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                      <h2 className="text-lg font-bold">Trésorerie en fin d&apos;exercice</h2>
                      <LegendeScenarios />
                    </div>
                    <Colonnes
                      colonnes={[
                        ...(donnees.realise
                          ? [{ libelle: donnees.realise.label, valeur: valeur(donnees.realise, "agregat.disponibilites") }]
                          : []),
                        ...donnees.plan.map((l) => ({ libelle: String(l.annee), valeur: l.tresorerieFin, projete: true })),
                      ]}
                    />
                  </section>
                  <CompteDeResultat realise={donnees.realise} exercices={donnees.exercices} devise={devise} />
                  <PlanDeFinancement plan={donnees.plan} devise={devise} />
                </div>
              </div>

              <p className="text-xs text-ink-3 max-w-prose">
                Méthode : compte de résultat projeté à partir des hypothèses, bilan piloté par les délais, les
                investissements et les emprunts, trésorerie en solde. Limites : pas de report des déficits (l&apos;impôt
                est donc légèrement surestimé après une perte), amortissement linéaire sur l&apos;ensemble des
                immobilisations, remboursements d&apos;emprunt à confirmer sur les tableaux d&apos;amortissement.
              </p>
            </div>
          )
        )}
      </Zone>
    </div>
  );
}

/** La réponse à la question qu'on vient poser : faut-il financer ? */
function Verdict({ donnees, devise }: { donnees: Previsionnel; devise: string }) {
  const manques = donnees.plan.filter((l) => l.tresorerieFin < 0);
  if (donnees.plan.length === 0) return null;
  if (manques.length > 0) {
    const pire = manques.reduce((a, b) => (b.tresorerieFin < a.tresorerieFin ? b : a));
    return (
      <section className="card flex items-start gap-3 border border-critical/30" aria-live="polite">
        <AlertTriangle size={22} className="text-critical flex-none mt-0.5" aria-hidden="true" />
        <div>
          <h2 className="font-bold">
            Il manque {formatCurrency(-pire.tresorerieFin, devise)} en {pire.annee}
            {manques[0].annee !== pire.annee ? `, dès ${manques[0].annee}` : ""}.
          </h2>
          <p className="text-sm text-ink-2">
            À financer par un emprunt, un apport en compte courant, ou en réduisant le besoin en fonds de roulement
            (délais clients, stocks). Ajustez les hypothèses à gauche pour voir l&apos;effet de chaque levier.
          </p>
        </div>
      </section>
    );
  }
  const bas = donnees.plan.reduce((a, b) => (b.tresorerieFin < a.tresorerieFin ? b : a));
  return (
    <section className="card flex items-start gap-3" aria-live="polite">
      <CircleCheck size={22} className="text-success flex-none mt-0.5" aria-hidden="true" />
      <div>
        <h2 className="font-bold">
          La trésorerie reste positive sur les {donnees.plan.length} exercices projetés.
        </h2>
        <p className="text-sm text-ink-2">
          Point bas : {formatCurrency(bas.tresorerieFin, devise)} en fin d&apos;exercice {bas.annee}. Pas de besoin de
          financement avec ces hypothèses.
        </p>
      </div>
    </section>
  );
}

function Scenarios({
  scenarios,
  croissance,
  surChoix,
}: {
  scenarios: ResumeScenario[];
  croissance: number;
  surChoix: (croissanceCa: number) => void;
}) {
  if (scenarios.length === 0) return null;
  return (
    <section aria-labelledby="titre-scenarios" className="space-y-3">
      <div>
        <h2 id="titre-scenarios" className="text-lg font-bold">
          Trois scénarios de croissance
        </h2>
        <p className="text-sm text-ink-3">
          Cinq points de croissance de part et d&apos;autre du scénario retenu ; les charges fixes ne bougent pas. Un
          banquier attend de voir que plusieurs scénarios ont été testés.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {scenarios.map((s) => {
          const retenu = Math.abs(s.croissanceCa - croissance) < 1e-9;
          return (
            <div key={s.id} className={`card py-4 ${retenu ? "ring-2 ring-primary/60" : ""}`}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-bold">{s.libelle}</h3>
                <span className="text-sm tabular-nums text-ink-2">{pourcentSigne(s.croissanceCa)} par an</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <dt className="text-ink-3">CA final</dt>
                <dd className="text-right tabular-nums">{montantCourt(s.chiffreAffairesFinal)}</dd>
                <dt className="text-ink-3">Résultat cumulé</dt>
                <dd className={`text-right tabular-nums ${s.resultatNetCumule < 0 ? "text-critical" : ""}`}>
                  {montantCourt(s.resultatNetCumule)}
                </dd>
                <dt className="text-ink-3">Trésorerie finale</dt>
                <dd className={`text-right tabular-nums font-semibold ${s.tresorerieFinale < 0 ? "text-critical" : ""}`}>
                  {montantCourt(s.tresorerieFinale)}
                </dd>
                <dt className="text-ink-3">Besoin de financement</dt>
                <dd className={`text-right tabular-nums ${s.besoinMaximal > 0 ? "text-critical font-semibold" : "text-ink-3"}`}>
                  {s.besoinMaximal > 0 ? montantCourt(s.besoinMaximal) : "aucun"}
                </dd>
              </dl>
              {retenu ? (
                <p className="mt-3 text-xs font-semibold text-primary">Scénario affiché ci-dessous</p>
              ) : (
                <button type="button" className="mt-3 text-sm font-semibold text-primary hover:underline" onClick={() => surChoix(s.croissanceCa)}>
                  Afficher ce scénario
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PanneauHypotheses({
  hypotheses,
  reference,
  depart,
  devise,
  surChangement,
}: {
  hypotheses: Hypotheses;
  reference: Previsionnel["reference"];
  depart: number | null;
  devise: string;
  surChangement: (h: Hypotheses) => void;
}) {
  return (
    <section className="card space-y-5 xl:sticky xl:top-24" aria-labelledby="titre-hypotheses">
      <div>
        <h2 id="titre-hypotheses" className="text-lg font-bold">
          Hypothèses
        </h2>
        <p className="text-xs text-ink-3">
          En gris, la valeur constatée en {depart}. Chaque modification se répercute tout de suite à droite.
        </p>
      </div>
      {GROUPES.map((groupe) => (
        <fieldset key={groupe.titre} className="space-y-3">
          <legend className="text-xs font-bold uppercase tracking-wide text-primary mb-2">{groupe.titre}</legend>
          {groupe.champs.map((champ) => {
            const id = `hyp-${champ.cle}`;
            const constate = reference[champ.cle];
            return (
              <div key={champ.cle}>
                <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-medium">
                  <span>{champ.libelle}</span>
                  {champ.aide && <span className="text-xs font-normal text-ink-3 text-right">{champ.aide}</span>}
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id={id}
                    type="number"
                    step={champ.pas}
                    className="input py-1.5 tabular-nums"
                    value={enSaisie(champ, hypotheses[champ.cle])}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) surChangement({ ...hypotheses, [champ.cle]: depuisSaisie(champ, v) });
                    }}
                  />
                  <span className="w-7 flex-none text-sm text-ink-3">{champ.unite === "€" && devise !== "EUR" ? devise : champ.unite}</span>
                </div>
                {constate !== undefined && champ.reference && (
                  <p className="mt-0.5 text-xs text-ink-3">
                    {depart} : {champ.reference(constate)}
                  </p>
                )}
              </div>
            );
          })}
        </fieldset>
      ))}
    </section>
  );
}

const LIGNES_RESULTAT: Array<{ id: string; libelle: string; total?: boolean; calcul?: (e: SerieExercice) => number | null }> = [
  { id: "agregat.chiffreAffaires", libelle: "Chiffre d'affaires", total: true },
  { id: "agregat.achatsConsommes", libelle: "Achats consommés" },
  { id: "agregat.chargesExternes", libelle: "Charges externes" },
  { id: "agregat.chargesPersonnel", libelle: "Charges de personnel" },
  { id: "agregat.impotsTaxes", libelle: "Impôts et taxes" },
  { id: "derive.ebitda", libelle: "EBITDA", total: true },
  { id: "agregat.dotationsAmortissements", libelle: "Dotations aux amortissements" },
  { id: "derive.ebit", libelle: "Résultat d'exploitation", total: true },
  { id: "agregat.chargesFinancieres", libelle: "Charges financières" },
  { id: "agregat.impotSocietes", libelle: "Impôt sur les sociétés" },
  { id: "derive.resultatNet", libelle: "Résultat net", total: true },
  {
    id: "caf",
    libelle: "Capacité d'autofinancement",
    total: true,
    calcul: (e) => {
      const rn = valeur(e, "derive.resultatNet");
      const dot = valeur(e, "agregat.dotationsAmortissements");
      return rn === null ? null : rn + (dot ?? 0);
    },
  },
];

function EnTeteProjete({ libelle }: { libelle: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 justify-end">
      <span className="h-2.5 w-2.5 rounded-[2px]" style={HACHURE} aria-hidden="true" />
      {libelle} prév.
    </span>
  );
}

function CompteDeResultat({ realise, exercices, devise }: { realise: SerieExercice | null; exercices: SerieExercice[]; devise: string }) {
  const colonnes = [...(realise ? [realise] : []), ...exercices];
  return (
    <section className="card p-0 overflow-x-auto" aria-labelledby="titre-cr">
      <h2 id="titre-cr" className="text-lg font-bold px-6 pt-5 pb-3">
        Compte de résultat prévisionnel
      </h2>
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-ink-3 border-y border-rule/10 bg-surface-2">
            <th className="px-6 py-2.5 text-left font-semibold">Poste</th>
            {colonnes.map((e) => (
              <th key={`${e.annee}-${e.reel}`} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                {e.reel ? `${e.label} réel` : <EnTeteProjete libelle={e.label} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LIGNES_RESULTAT.map((l) => (
            <tr key={l.id} className="border-t border-rule/[0.06]">
              <th scope="row" className={`px-6 py-2 text-left ${l.total ? "font-semibold" : "font-normal text-ink-2 pl-8"}`}>
                {l.libelle}
              </th>
              {colonnes.map((e) => {
                const v = l.calcul ? l.calcul(e) : valeur(e, l.id);
                return (
                  <td
                    key={`${e.annee}-${e.reel}`}
                    className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${e.reel ? "text-ink-2" : ""} ${
                      l.total ? "font-semibold" : ""
                    } ${v !== null && v < 0 ? "text-critical" : ""}`}
                  >
                    {v === null ? "—" : formatCurrency(v, devise)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PlanDeFinancement({ plan, devise }: { plan: LignePlan[]; devise: string }) {
  if (plan.length === 0) return null;
  const ligne = (libelle: string, valeurs: number[], options: { total?: boolean; signe?: boolean } = {}) => (
    <tr className="border-t border-rule/[0.06]">
      <th scope="row" className={`px-6 py-2 text-left ${options.total ? "font-semibold" : "font-normal text-ink-2 pl-8"}`}>
        {libelle}
      </th>
      {valeurs.map((v, i) => (
        <td
          key={plan[i].annee}
          className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${options.total ? "font-semibold" : ""} ${
            options.signe && v < 0 ? "text-critical" : ""
          }`}
        >
          {Math.round(v) === 0 && !options.total ? "—" : formatCurrency(v, devise)}
        </td>
      ))}
    </tr>
  );
  const groupe = (titre: string) => (
    <tr>
      <th colSpan={plan.length + 1} className="px-6 pt-4 pb-1 text-left text-xs font-bold uppercase tracking-wide text-primary">
        {titre}
      </th>
    </tr>
  );
  return (
    <section className="card p-0 overflow-x-auto" aria-labelledby="titre-plan">
      <div className="px-6 pt-5 pb-3">
        <h2 id="titre-plan" className="text-lg font-bold">
          Plan de financement
        </h2>
        <p className="text-sm text-ink-3">
          Ce que l&apos;entreprise doit financer chaque année, et avec quoi. Présentation attendue par les banques.
        </p>
      </div>
      <table className="w-full text-sm min-w-[520px]">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-ink-3 border-y border-rule/10 bg-surface-2">
            <th className="px-6 py-2.5 text-left font-semibold">Poste</th>
            {plan.map((l) => (
              <th key={l.annee} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                <EnTeteProjete libelle={String(l.annee)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupe("Besoins")}
          {ligne("Investissements", plan.map((l) => l.besoins.investissements))}
          {ligne("Augmentation du besoin en fonds de roulement", plan.map((l) => l.besoins.augmentationBfr))}
          {ligne("Remboursement d'emprunts", plan.map((l) => l.besoins.remboursements))}
          {ligne("Dividendes", plan.map((l) => l.besoins.dividendes))}
          {ligne("Total des besoins", plan.map((l) => l.besoins.total), { total: true })}
          {groupe("Ressources")}
          {ligne("Capacité d'autofinancement", plan.map((l) => l.ressources.caf), { signe: true })}
          {ligne("Nouveaux emprunts", plan.map((l) => l.ressources.emprunts))}
          {ligne("Diminution du besoin en fonds de roulement", plan.map((l) => l.ressources.diminutionBfr))}
          {ligne("Total des ressources", plan.map((l) => l.ressources.total), { total: true, signe: true })}
          {groupe("Résultat")}
          {ligne("Excédent ou manque de l'année", plan.map((l) => l.solde), { total: true, signe: true })}
          {ligne("Trésorerie de fin d'exercice", plan.map((l) => l.tresorerieFin), { total: true, signe: true })}
        </tbody>
      </table>
    </section>
  );
}
