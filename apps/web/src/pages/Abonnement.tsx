import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useDemarrerCheckout, useEtatAbonnement, useOuvrirPortail } from "../api/hooks";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { FORMULES, prixAnnualise } from "../lib/formules";
import {
  type EtatAbonnement,
  type PlanId,
  type Ton,
  libelleBouton,
  lireStatut,
  partUtilisee,
  quotaAtteint,
  resiliationPossible,
} from "../lib/abonnement";

const TONS: Record<Ton, string> = {
  neutre: "border-rule/20",
  attention: "border-warning/40 bg-warning-soft",
  critique: "border-critical/40 bg-critical-soft",
};

/**
 * Jauge de consommation d'un quota.
 *
 * Le nombre est écrit en toutes lettres à côté : la barre donne l'ordre de
 * grandeur d'un coup d'œil, le texte donne la valeur. La couleur ne porte
 * jamais seule l'information « vous êtes au plafond » — un quota atteint le
 * dit aussi en mots.
 */
function Jauge({
  libelle,
  actuel,
  limite,
}: {
  libelle: string;
  actuel: number;
  limite: number | null;
}) {
  const part = partUtilisee(actuel, limite);
  const atteint = quotaAtteint(actuel, limite);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-ink/70">{libelle}</span>
        <span className="text-sm tabular-nums font-medium">
          {actuel}
          <span className="text-ink/40"> / {limite === null ? "illimité" : limite}</span>
        </span>
      </div>
      {part !== null && (
        <div
          className="mt-1.5 h-1.5 rounded-full bg-surface-2 overflow-hidden"
          role="img"
          aria-label={`${actuel} sur ${limite}`}
        >
          <div
            className={`h-full rounded-full ${atteint ? "bg-warning" : "bg-primary"}`}
            style={{ width: `${Math.max(part * 100, 3)}%` }}
          />
        </div>
      )}
      {atteint && (
        <p className="text-xs text-warning mt-1">
          Plafond atteint — une formule supérieure en autorise davantage.
        </p>
      )}
    </div>
  );
}

function CarteFormule({
  formule,
  etat,
  maintenant,
  estAdmin,
  surChoix,
  enCours,
}: {
  formule: (typeof FORMULES)[number];
  etat: EtatAbonnement;
  maintenant: Date;
  estAdmin: boolean;
  surChoix: (plan: PlanId) => void;
  enCours: PlanId | null;
}) {
  const bouton = libelleBouton(etat, formule.id, maintenant);
  const courante = etat.plan.id === formule.id;

  return (
    <div
      className={`card flex flex-col ${courante ? "border-primary/50 ring-1 ring-primary/20" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">{formule.label}</h3>
        {courante && (
          <span className="text-xs text-primary font-medium whitespace-nowrap">En cours</span>
        )}
      </div>
      <p className="text-xs text-ink/50 mt-0.5 min-h-[2rem]">{formule.pourQui}</p>

      <p className="mt-3">
        {formule.prixMensuel === null ? (
          <span className="font-display text-2xl font-semibold">Gratuit</span>
        ) : (
          <>
            <span className="font-display text-2xl font-semibold tabular-nums">
              {formule.prixMensuel} €
            </span>
            <span className="text-sm text-ink/50"> HT / mois</span>
          </>
        )}
      </p>
      <p className="text-xs text-ink/45 min-h-[1.5rem] mb-4">
        {formule.prixMensuel === null
          ? "14 jours"
          : `ou ${prixAnnualise(formule.prixMensuel)} € HT/mois à l'année`}
      </p>

      <ul className="mt-3 space-y-1.5 text-sm text-ink/70">
        {formule.arguments.map((argument) => (
          <li key={argument} className="flex gap-2">
            <span className="text-primary mt-0.5 flex-none" aria-hidden="true">
              ·
            </span>
            {argument}
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={`${courante ? "btn-secondary" : "btn-primary"} w-full mt-auto min-h-[3.5rem]`}
        disabled={!bouton.actif || !estAdmin || enCours !== null || !etat.paiementDisponible}
        onClick={() => surChoix(formule.id)}
      >
        {enCours === formule.id ? "Ouverture…" : bouton.texte}
      </button>
    </div>
  );
}

export function AbonnementPage() {
  const { user } = useAuth();
  const { data: etat, isLoading, error } = useEtatAbonnement();
  const checkout = useDemarrerCheckout();
  const portail = useOuvrirPortail();
  const queryClient = useQueryClient();
  const [parametres, setParametres] = useSearchParams();
  const [echec, setEchec] = useState<string | null>(null);
  const [planEnCours, setPlanEnCours] = useState<PlanId | null>(null);

  const retourPaiement = parametres.get("paiement");

  /*
   * Au retour de Stripe, l'abonnement affiché peut encore être l'ancien :
   * c'est le webhook qui fait foi, et il arrive une poignée de secondes plus
   * tard. On relit l'état plutôt que de montrer une formule périmée, et le
   * message dit que la confirmation est en cours — sans quoi l'utilisateur
   * qui vient de payer croit que son paiement n'a servi à rien.
   */
  useEffect(() => {
    if (retourPaiement !== "succes") return;
    const relectures = [1000, 3000, 6000].map((delai) =>
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["abonnement"] });
      }, delai),
    );
    return () => relectures.forEach(window.clearTimeout);
  }, [retourPaiement, queryClient]);

  const estAdmin = user?.role === "ADMIN";
  const maintenant = new Date();

  async function allerChezStripe(action: () => Promise<{ url: string }>, plan: PlanId | null) {
    setEchec(null);
    setPlanEnCours(plan);
    try {
      const { url } = await action();
      window.location.href = url;
    } catch (erreur) {
      setPlanEnCours(null);
      setEchec(
        erreur instanceof ApiError
          ? erreur.message
          : "Impossible d'ouvrir la page de paiement. Réessayez dans un instant.",
      );
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-48 rounded bg-surface-2 animate-pulse" />
        <div className="h-32 rounded bg-surface-2 animate-pulse" />
      </div>
    );
  }

  if (error || !etat) {
    return (
      <div className="card border-critical/40">
        <h1 className="font-display text-lg font-semibold">Abonnement indisponible</h1>
        <p className="text-sm text-ink/70 mt-1">
          {error instanceof ApiError
            ? error.message
            : "Nous n'avons pas pu lire l'état de votre abonnement."}
        </p>
      </div>
    );
  }

  const lecture = lireStatut(etat, maintenant);
  const resiliation = resiliationPossible(etat);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Abonnement</h1>
        <p className="text-sm text-ink/60 mt-1">
          Votre formule, ce qu&apos;elle autorise, et comment en changer ou la résilier.
        </p>
      </div>

      {retourPaiement === "succes" && (
        <div className="card border-success/40 bg-success-soft">
          <p className="font-medium text-sm">Paiement accepté</p>
          <p className="text-sm text-ink/75 mt-1">
            Nous attendons la confirmation de notre prestataire — quelques secondes. Votre formule
            se met à jour ci-dessous dès qu&apos;elle nous parvient.
          </p>
        </div>
      )}
      {retourPaiement === "annule" && (
        <div className="card">
          <p className="font-medium text-sm">Paiement abandonné</p>
          <p className="text-sm text-ink/75 mt-1">
            Rien n&apos;a été prélevé et votre formule n&apos;a pas changé.{" "}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setParametres({}, { replace: true })}
            >
              Fermer
            </button>
          </p>
        </div>
      )}

      {/* État courant */}
      <section className={`card ${TONS[lecture.ton]}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="label">Formule en cours</p>
            <p className="font-display text-xl font-semibold mt-0.5">{etat.plan.label}</p>
            <p className="text-sm text-ink/60 mt-0.5">{etat.plan.promesse}</p>
          </div>
          <div className="min-w-0 sm:text-right">
            <p className="label">État</p>
            <p className="font-medium mt-0.5">{lecture.titre}</p>
          </div>
        </div>
        <p className="text-sm text-ink/70 mt-3">{lecture.explication}</p>
        {!etat.accesOuvert && (
          <p className="text-sm text-critical mt-2">
            L&apos;accès aux analyses est suspendu. Vos données restent intactes.
          </p>
        )}
      </section>

      {/* Consommation */}
      <section className="card">
        <h2 className="font-display text-base font-semibold mb-3">Ce que vous utilisez</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Jauge
            libelle="Entreprises suivies"
            actuel={etat.consommation.entites}
            limite={etat.plan.quotas.entites}
          />
          <Jauge
            libelle="Utilisateurs"
            actuel={etat.consommation.utilisateurs}
            limite={etat.plan.quotas.utilisateurs}
          />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-sm text-ink/60">
          <span>
            Import FEC :{" "}
            <span className="text-ink">{etat.plan.quotas.fec ? "inclus" : "non inclus"}</span>
          </span>
          <span>
            Consolidation de groupe :{" "}
            <span className="text-ink">
              {etat.plan.quotas.consolidation ? "incluse" : "non incluse"}
            </span>
          </span>
          <span>
            Documents à votre marque :{" "}
            <span className="text-ink">
              {etat.plan.quotas.marqueDocuments ? "inclus" : "non inclus"}
            </span>
          </span>
        </div>
      </section>

      {/* Avertissements d'environnement, dits franchement plutôt que
          masqués derrière un bouton qui échouerait au clic. */}
      {!etat.paiementDisponible && (
        <div className="card border-warning/40 bg-warning-soft">
          <p className="font-medium text-sm">Souscription momentanément indisponible</p>
          <p className="text-sm text-ink/75 mt-1">
            Le paiement en ligne n&apos;est pas actif sur cette instance. Aucun changement de
            formule ne peut aboutir pour l&apos;instant — nous écrire reste le moyen le plus
            rapide.
          </p>
        </div>
      )}
      {!estAdmin && (
        <div className="card">
          <p className="text-sm text-ink/70">
            Seul un administrateur de votre organisation peut changer de formule ou résilier. Vous
            pouvez consulter cet écran librement.
          </p>
        </div>
      )}
      {echec && <p className="text-sm text-critical">{echec}</p>}

      {/* Formules */}
      <section>
        <h2 className="font-display text-lg font-semibold mb-3">Changer de formule</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FORMULES.map((formule) => (
            <CarteFormule
              key={formule.id}
              formule={formule}
              etat={etat}
              maintenant={maintenant}
              estAdmin={estAdmin}
              enCours={planEnCours}
              surChoix={(plan) =>
                void allerChezStripe(() => checkout.mutateAsync(plan), plan)
              }
            />
          ))}
        </div>
        <p className="text-xs text-ink/45 mt-3">
          Les montants sont hors taxes. Un changement en cours de période est calculé au prorata
          par notre prestataire de paiement. Conditions complètes dans les{" "}
          <Link to="/cgv" className="text-primary hover:underline">
            conditions générales de vente
          </Link>
          .
        </p>
      </section>

      {/*
        Résiliation en ligne. Les conditions générales la promettent en trois
        clics, et l'article L. 215-1-1 du code de la consommation l'impose
        pour un contrat conclu en ligne. Quand elle n'est pas possible,
        l'écran dit pourquoi et par où passer — une promesse contractuelle
        dont l'interface ne dit rien est un manquement.
      */}
      <section className="card">
        <h2 className="font-display text-base font-semibold">Résilier mon abonnement</h2>
        {resiliation.possible ? (
          <>
            <p className="text-sm text-ink/70 mt-1">
              Sans justification à fournir. Votre accès reste entier jusqu&apos;au terme de la
              période déjà payée, et vos données sont conservées trois mois ensuite.
            </p>
            <button
              type="button"
              className="btn-secondary mt-3"
              disabled={!estAdmin || planEnCours !== null}
              onClick={() => void allerChezStripe(() => portail.mutateAsync(), null)}
            >
              Résilier mon abonnement
            </button>
            <p className="text-xs text-ink/45 mt-2">
              Vous pourrez aussi, depuis le même écran, changer de carte et retrouver vos factures.
            </p>
          </>
        ) : (
          <p className="text-sm text-ink/70 mt-1">{resiliation.motif}</p>
        )}
      </section>
    </div>
  );
}
