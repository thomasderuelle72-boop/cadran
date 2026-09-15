import { useState } from "react";
import { Link } from "react-router-dom";
import { useDemanderReinitialisation } from "../api/hooks";
import { ApiError } from "../api/client";
import { CadreAuth } from "../components/CadreAuth";

export function MotDePasseOubli() {
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const demande = useDemanderReinitialisation();

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    try {
      await demande.mutateAsync({ email });
      setEnvoye(true);
    } catch (err) {
      /*
       * L'API répond 204 que l'adresse existe ou non : on n'arrive ici que
       * sur une adresse mal formée ou une limitation de débit. Une panne
       * réseau ne doit pas laisser croire que le courriel est parti.
       */
      setErreur(err instanceof ApiError ? err.message : "Demande impossible pour le moment.");
    }
  }

  /*
   * Le message de confirmation ne dit pas si l'adresse est connue, parce que
   * l'API ne le dit pas non plus : une réponse différenciée transformerait cet
   * écran en annuaire de clients, interrogeable adresse par adresse.
   */
  if (envoye) {
    return (
      <CadreAuth titre="Vérifiez votre messagerie">
        <p className="text-sm text-ink/70">
          Si un compte est associé à <span className="font-medium text-ink">{email}</span>, un lien
          de réinitialisation vient d'y être envoyé. Il est valable une heure, et une seule fois.
        </p>
        <p className="text-sm text-ink/70">
          Rien reçu au bout de quelques minutes ? Vérifiez les indésirables, puis{" "}
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => setEnvoye(false)}
          >
            recommencez
          </button>
          .
        </p>
        <Link to="/login" className="btn-secondary w-full text-center block">
          Retour à la connexion
        </Link>
      </CadreAuth>
    );
  }

  return (
    <CadreAuth titre="Mot de passe oublié">
      <p className="text-sm text-ink/70">
        Indiquez l'adresse de votre compte. Nous vous enverrons un lien pour choisir un nouveau mot
        de passe.
      </p>
      <form onSubmit={soumettre} className="space-y-4">
        <div>
          <label className="label" htmlFor="oubli-email">
            E-mail
          </label>
          <input
            id="oubli-email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {erreur && <p className="text-critical text-sm">{erreur}</p>}
        <button type="submit" className="btn-primary w-full" disabled={demande.isPending}>
          {demande.isPending ? "Envoi…" : "Envoyer le lien"}
        </button>
      </form>
      <p className="text-xs text-ink/50 text-center">
        <Link to="/login" className="text-primary hover:underline">
          Revenir à la connexion
        </Link>
      </p>
    </CadreAuth>
  );
}
