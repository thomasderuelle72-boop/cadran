import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/*
 * Le même cadre pour les quatre écrans hors session : connexion, inscription,
 * demande de réinitialisation, nouveau mot de passe. La marque y était
 * recopiée à l'identique — quatre exemplaires du même dégradé conique, qu'il
 * aurait fallu corriger quatre fois au prochain changement de palette.
 *
 * La marque renvoie à l'accueil : c'est le seul chemin de retour depuis ces
 * écrans, et un visiteur arrivé sur la connexion par erreur n'en avait aucun.
 */
export function CadreAuth({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-paper">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="flex items-center gap-2 mb-8 justify-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary rounded"
        >
          <span
            className="w-7 h-7 rounded-full flex-none"
            style={{
              background:
                "conic-gradient(from -90deg, rgb(var(--accent)) 0 25%, rgb(var(--surface-2)) 25% 100%)",
            }}
          />
          <span className="font-display font-semibold text-2xl">Cadran</span>
        </Link>
        <div className="card space-y-4">
          <h1 className="font-display text-lg font-semibold">{titre}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
