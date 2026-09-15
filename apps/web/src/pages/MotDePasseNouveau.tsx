import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useReinitialiserMotDePasse } from "../api/hooks";
import { ApiError } from "../api/client";
import { CadreAuth } from "../components/CadreAuth";

/* Même plancher qu'à l'inscription : une réinitialisation ne doit pas être
 * l'occasion d'affaiblir un mot de passe. La valeur est celle que l'API
 * impose ; l'annoncer ici évite un aller-retour serveur pour l'apprendre. */
const LONGUEUR_MINIMALE = 8;

export function MotDePasseNouveau() {
  const navigate = useNavigate();
  const reinitialiser = useReinitialiserMotDePasse();
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  /*
   * Le jeton est lu une fois, gardé en mémoire, puis retiré de la barre
   * d'adresse. Laissé dans l'URL, il entrerait dans l'historique du
   * navigateur et, sur toute requête sortante de la page, dans l'en-tête
   * Referer — un jeton valable une heure n'a rien à faire dans un journal
   * d'accès tiers. Une ref plutôt qu'un état : sa valeur ne doit pas changer
   * d'un rendu à l'autre, et n'a rien à déclencher quand elle est lue.
   */
  const jeton = useRef<string | null>(null);
  const [jetonPresent, setJetonPresent] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const valeur = params.get("jeton");
    if (!valeur) return;
    jeton.current = valeur;
    setJetonPresent(true);
    params.delete("jeton");
    const reste = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (reste ? `?${reste}` : ""));
  }, []);

  if (!jetonPresent) {
    return (
      <CadreAuth titre="Lien incomplet">
        <p className="text-sm text-ink/70">
          Cette adresse ne contient pas de jeton de réinitialisation. Les liens reçus par courriel
          sont parfois coupés en deux par la messagerie : copiez-le entièrement, ou demandez-en un
          nouveau.
        </p>
        <Link to="/mot-de-passe/oubli" className="btn-primary w-full text-center block">
          Demander un nouveau lien
        </Link>
      </CadreAuth>
    );
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);

    /* Vérifié ici pour ne pas consommer le jeton sur une faute de frappe :
     * l'API l'invalide dès qu'elle l'accepte, et il ne resservirait pas. */
    if (motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (motDePasse.length < LONGUEUR_MINIMALE) {
      setErreur(`Le mot de passe doit faire au moins ${LONGUEUR_MINIMALE} caractères.`);
      return;
    }

    try {
      await reinitialiser.mutateAsync({ jeton: jeton.current ?? "", motDePasse });
      navigate("/login", { replace: true, state: { motDePasseChange: true } });
    } catch (err) {
      setErreur(
        err instanceof ApiError
          ? err.message
          : "Réinitialisation impossible. Le lien a peut-être expiré ou déjà servi.",
      );
    }
  }

  return (
    <CadreAuth titre="Nouveau mot de passe">
      <form onSubmit={soumettre} className="space-y-4">
        <div>
          <label className="label" htmlFor="nouveau-mdp">
            Mot de passe
          </label>
          <input
            id="nouveau-mdp"
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={LONGUEUR_MINIMALE}
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            required
          />
          <p className="text-xs text-ink/50 mt-1">{LONGUEUR_MINIMALE} caractères au minimum.</p>
        </div>
        <div>
          <label className="label" htmlFor="nouveau-mdp-confirmation">
            Confirmation
          </label>
          <input
            id="nouveau-mdp-confirmation"
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            required
          />
        </div>
        {erreur && <p className="text-critical text-sm">{erreur}</p>}
        <button type="submit" className="btn-primary w-full" disabled={reinitialiser.isPending}>
          {reinitialiser.isPending ? "Enregistrement…" : "Enregistrer et se connecter"}
        </button>
      </form>
      <p className="text-xs text-ink/50 text-center">
        Le lien n'est valable qu'une heure, et ne sert qu'une fois.{" "}
        <Link to="/mot-de-passe/oubli" className="text-primary hover:underline">
          En demander un autre
        </Link>
      </p>
    </CadreAuth>
  );
}
