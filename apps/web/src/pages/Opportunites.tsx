import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, PhoneCall } from "lucide-react";
import { useOpportunites } from "../api/hooks";
import type { DossierOpportunites, Opportunite, PrioriteOpportunite } from "../api/types";
import { CarteOpportunite, PRIORITES } from "../components/opportunites/CarteOpportunite";
import { EntetePage, EtatVide, SqueletteTuiles, Zone } from "../components/etats";
import { choisirDossier } from "../lib/dossierCourant";
import { formatCurrency } from "../lib/format";

/**
 * Les missions à proposer, sur tout le portefeuille.
 *
 * L'écran du lundi matin d'un collaborateur : en haut, les dossiers à
 * appeler cette semaine — les plus urgents, puis les plus gros enjeux — ;
 * en dessous, toutes les missions, dossier par dossier, chacune prête à
 * passer au plan d'action.
 */

const RANG: Record<PrioriteOpportunite, number> = { urgente: 0, haute: 1, normale: 2 };

type Filtre = "toutes" | PrioriteOpportunite;

/** Un dossier se classe par sa mission la plus urgente, puis par l'enjeu total. */
function classer(a: DossierOpportunites, b: DossierOpportunites): number {
  const rang = (d: DossierOpportunites) => Math.min(...d.opportunites.map((o) => RANG[o.priorite]));
  const total = (d: DossierOpportunites) => d.opportunites.reduce((s, o) => s + o.enjeu, 0);
  return rang(a) - rang(b) || total(b) - total(a);
}

export function OpportunitesPage() {
  const { data, isLoading, error, refetch } = useOpportunites();
  const navigate = useNavigate();
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [masquerPlan, setMasquerPlan] = useState(false);

  const avecMissions = useMemo(
    () => (data ?? []).filter((d) => d.opportunites.length > 0).sort(classer),
    [data],
  );
  const toutes = avecMissions.flatMap((d) => d.opportunites);
  const somme = (nature: Opportunite["natureEnjeu"]) =>
    toutes.filter((o) => o.natureEnjeu === nature).reduce((s, o) => s + o.enjeu, 0);
  const aAppeler = avecMissions.filter((d) => d.opportunites.some((o) => !o.dansLePlan)).slice(0, 5);
  const sansExercice = (data ?? []).filter((d) => d.exercice === null).length;

  const visible = (o: Opportunite) => (filtre === "toutes" || o.priorite === filtre) && !(masquerPlan && o.dansLePlan);

  function ouvrir(entityId: string) {
    choisirDossier(entityId);
    navigate("/tableau-de-bord");
  }

  return (
    <div className="space-y-6">
      <EntetePage
        titre="Missions à proposer"
        sousTitre="Ce que les chiffres de chaque dossier appellent, chiffré en euros, sur son dernier exercice complet."
      />

      <Zone
        chargement={isLoading}
        erreur={error}
        onReessayer={() => void refetch()}
        quoi="les missions"
        squelette={<SqueletteTuiles />}
      >
        {avecMissions.length === 0 ? (
          <EtatVide titre="Aucune mission détectée">
            {sansExercice > 0
              ? `Les missions se calculent sur un exercice complet ; ${sansExercice} dossier${sansExercice > 1 ? "s n'en ont" : " n'en a"} pas encore. Les autres ne présentent aucun signal à traiter.`
              : "Aucun dossier ne présente de signal à traiter sur son dernier exercice."}
          </EtatVide>
        ) : (
          <div className="space-y-8">
            {/* Les montants nuls ne sont pas affichés : une tuile « 0 € » prend
                la place d'une information sans en donner une. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Tuile valeur={String(toutes.length)} libelle={`missions sur ${avecMissions.length} dossier${avecMissions.length > 1 ? "s" : ""}`} />
              {[
                { montant: somme("tresorerie"), libelle: "de trésorerie à libérer" },
                { montant: somme("resultat"), libelle: "de résultat en jeu, par an" },
                { montant: somme("financement") + somme("obligation"), libelle: "à financer ou reconstituer" },
              ]
                .filter((t) => Math.round(t.montant) > 0)
                .map((t) => (
                  <Tuile key={t.libelle} valeur={`≈ ${formatCurrency(Math.round(t.montant))}`} libelle={t.libelle} />
                ))}
            </div>

            {aAppeler.length > 0 && (
              <section className="apparition">
                <div className="flex items-center gap-2 mb-1">
                  <PhoneCall size={18} className="text-primary" aria-hidden="true" />
                  <h2 className="text-lg font-bold">À appeler cette semaine</h2>
                </div>
                <p className="text-sm text-ink-3 mb-4">
                  Les dossiers les plus urgents d&apos;abord, puis ceux où l&apos;enjeu est le plus gros.
                </p>
                <ol className="card p-0 divide-y divide-rule/[0.07]">
                  {aAppeler.map((d, rang) => {
                    const premiere = d.opportunites.find((o) => !o.dansLePlan) ?? d.opportunites[0];
                    const priorite = PRIORITES[premiere.priorite];
                    const total = d.opportunites.reduce((s, o) => s + o.enjeu, 0);
                    return (
                      <li key={d.entityId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-6 py-3.5">
                        <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-surface-2 text-sm font-bold text-ink-2">
                          {rang + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold truncate">{d.nom}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${priorite.classe}`}>
                              <priorite.Icone size={12} aria-hidden="true" />
                              {priorite.libelle}
                            </span>
                          </div>
                          <div className="text-sm text-ink-3 truncate">
                            {premiere.mission}
                            {d.opportunites.length > 1 && ` · et ${d.opportunites.length - 1} autre${d.opportunites.length > 2 ? "s" : ""}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold tabular-nums">≈ {formatCurrency(Math.round(total), d.devise)}</div>
                          <div className="text-xs text-ink-3">en jeu</div>
                        </div>
                        <button type="button" className="btn-secondary py-1.5" onClick={() => ouvrir(d.entityId)}>
                          Ouvrir le dossier
                          <ArrowRight size={15} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Toutes les missions</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex gap-0.5 p-0.5 rounded-lg bg-ink/[0.06]" role="radiogroup" aria-label="Priorité">
                    {(["toutes", "urgente", "haute", "normale"] as Filtre[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        role="radio"
                        aria-checked={filtre === f}
                        onClick={() => setFiltre(f)}
                        className={`rounded-md px-2.5 py-1 text-sm font-medium transition ${
                          filtre === f ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"
                        }`}
                      >
                        {f === "toutes" ? "Toutes" : PRIORITES[f].libelle}
                      </button>
                    ))}
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-ink-2">
                    <input type="checkbox" checked={masquerPlan} onChange={(e) => setMasquerPlan(e.target.checked)} />
                    Masquer celles déjà au plan
                  </label>
                </div>
              </div>

              {avecMissions.map((d) => {
                const missions = d.opportunites.filter(visible);
                if (missions.length === 0) return null;
                return (
                  <div key={d.entityId} className="space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-bold">{d.nom}</h3>
                      <span className="text-xs text-ink-3">
                        Exercice {d.exercice}
                        {d.exerciceCompare ? `, comparé à ${d.exerciceCompare}` : ""}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                      {missions.map((o) => (
                        <CarteOpportunite key={o.type} opportunite={o} entityId={d.entityId} devise={d.devise} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>

            <p className="text-xs text-ink-3 max-w-prose">
              Les montants sont des ordres de grandeur, calculés à activité constante sur le dernier exercice complet,
              pour ouvrir la conversation. Les cibles sont prudentes : le seuil courant de l&apos;indicateur, ou la
              valeur de l&apos;exercice précédent quand elle était meilleure.
            </p>
          </div>
        )}
      </Zone>
    </div>
  );
}

function Tuile({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <div className="card apparition">
      <div className="text-[1.6rem] font-bold leading-tight tracking-tight">{valeur}</div>
      <div className="text-sm text-ink-3 mt-1">{libelle}</div>
    </div>
  );
}
