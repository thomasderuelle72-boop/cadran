import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";

/**
 * États partagés d'un écran : chargement, erreur, vide.
 *
 * Avant, chaque page se débrouillait : certaines affichaient « Chargement… »
 * en texte brut, d'autres rien du tout, et une requête en échec ne laissait
 * aucune trace à l'écran — l'utilisateur voyait une page vide sans savoir si
 * elle était lente, cassée, ou simplement sans données. Ces trois situations
 * demandent trois réponses différentes, et c'est ce que ce module fournit.
 */

/** Bloc gris à la forme du texte attendu, pour que la page ne saute pas. */
export function Ligne({ largeur = "100%", hauteur = "1rem" }: { largeur?: string; hauteur?: string }) {
  return (
    <div
      className="rounded bg-ink/[0.06] animate-pulse motion-reduce:animate-none"
      style={{ width: largeur, height: hauteur }}
    />
  );
}

/**
 * Squelette d'une rangée de tuiles de synthèse. Le nombre et la forme
 * reprennent ceux du contenu réel : un squelette qui ne ressemble pas à ce
 * qui arrive déplace la page au moment du remplacement, ce qui est plus
 * désagréable qu'un simple vide.
 */
export function SqueletteTuiles({ nombre = 4 }: { nombre?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: nombre }, (_, i) => (
        <div key={i} className="card space-y-2">
          <Ligne largeur="55%" hauteur="0.7rem" />
          <Ligne largeur="80%" hauteur="1.6rem" />
          <Ligne largeur="40%" hauteur="0.7rem" />
        </div>
      ))}
    </div>
  );
}

export function SqueletteTableau({ lignes = 6, colonnes = 4 }: { lignes?: number; colonnes?: number }) {
  return (
    <div className="card space-y-3">
      <Ligne largeur="30%" hauteur="1.1rem" />
      <div className="space-y-2 pt-1">
        {Array.from({ length: lignes }, (_, i) => (
          <div key={i} className="flex gap-4 items-center">
            {Array.from({ length: colonnes }, (_, j) => (
              <div key={j} className="flex-1">
                <Ligne largeur={j === 0 ? "70%" : "45%"} hauteur="0.85rem" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SqueletteCarte({ hauteur = "14rem" }: { hauteur?: string }) {
  return (
    <div className="card space-y-3">
      <Ligne largeur="35%" hauteur="1.1rem" />
      <Ligne largeur="60%" hauteur="0.8rem" />
      <div className="pt-2">
        <Ligne largeur="100%" hauteur={hauteur} />
      </div>
    </div>
  );
}

/**
 * Message d'erreur exploitable.
 *
 * Une erreur d'API porte une information que l'utilisateur peut utiliser — un
 * droit manquant, une période introuvable, un serveur injoignable — et la
 * masquer transforme un problème réparable en écran inerte. Le code HTTP est
 * traduit en ce que l'utilisateur peut en faire.
 */
export function EtatErreur({
  erreur,
  onReessayer,
  quoi = "ces données",
}: {
  erreur: unknown;
  onReessayer?: () => void;
  quoi?: string;
}) {
  const statut = erreur instanceof ApiError ? erreur.status : null;
  const message = erreur instanceof Error ? erreur.message : "Erreur inconnue.";

  const explication =
    statut === 401
      ? "Votre session a expiré. Reconnectez-vous pour continuer."
      : statut === 403
        ? `Votre rôle ne permet pas de consulter ${quoi}.`
        : statut === 404
          ? `${quoi.charAt(0).toUpperCase()}${quoi.slice(1)} n'existe pas ou plus.`
          : statut && statut >= 500
            ? "Le serveur a renvoyé une erreur. Si elle persiste, regardez les journaux de l'API."
            : "L'API est peut-être arrêtée, ou la requête a échoué en route.";

  return (
    <div className="card border-critical/30 bg-critical/[0.03]">
      <h2 className="text-sm font-semibold text-critical mb-1">
        Impossible de charger {quoi}
        {statut ? ` (erreur ${statut})` : ""}
      </h2>
      <p className="text-sm text-ink/70">{explication}</p>
      <p className="text-xs text-ink/40 font-mono mt-2 break-words">{message}</p>
      <div className="flex gap-3 mt-4">
        {onReessayer && (
          <button type="button" className="btn-secondary" onClick={onReessayer}>
            Réessayer
          </button>
        )}
        {statut === 401 && (
          <Link to="/login" className="btn-primary">
            Se reconnecter
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * État vide qui dit quoi faire.
 *
 * « Aucune donnée » laisse l'utilisateur devant un mur ; la seule version
 * utile nomme l'action qui remplit l'écran.
 */
export function EtatVide({
  titre,
  children,
  action,
}: {
  titre: string;
  children?: ReactNode;
  action?: { to: string; label: string };
}) {
  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold mb-1">{titre}</h2>
      {children && <div className="text-sm text-ink/60 max-w-prose">{children}</div>}
      {action && (
        <Link to={action.to} className="btn-primary inline-block mt-4">
          {action.label}
        </Link>
      )}
    </div>
  );
}

/**
 * Enveloppe une zone dépendant d'une requête : squelette pendant le
 * chargement, erreur exploitable en cas d'échec, contenu sinon.
 *
 * Le squelette est passé par l'appelant plutôt que choisi ici, parce que sa
 * forme dépend de ce qui arrive — une rangée de tuiles et un tableau de vingt
 * lignes n'occupent pas la même place.
 */
export function Zone({
  chargement,
  erreur,
  onReessayer,
  quoi,
  squelette,
  children,
}: {
  chargement: boolean;
  erreur: unknown;
  onReessayer?: () => void;
  quoi?: string;
  squelette: ReactNode;
  children: ReactNode;
}) {
  // L'erreur passe avant le chargement : lors d'une nouvelle tentative,
  // afficher un squelette par-dessus une erreur donnerait l'illusion que le
  // problème a disparu.
  if (erreur) return <EtatErreur erreur={erreur} onReessayer={onReessayer} quoi={quoi} />;
  if (chargement) return <>{squelette}</>;
  return <>{children}</>;
}

/**
 * En-tête de page : titre, sous-titre, et zone de contrôles qui passe à la
 * ligne plutôt que d'écraser le titre sur un écran étroit.
 */
export function EntetePage({
  titre,
  sousTitre,
  children,
}: {
  titre: string;
  sousTitre?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold">{titre}</h1>
        {sousTitre && <p className="text-sm text-ink/50 mt-0.5">{sousTitre}</p>}
      </div>
      {children && <div className="flex gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
