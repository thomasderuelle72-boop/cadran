import { useNavigate } from "react-router";
import { useDossierDemonstration, useEntities } from "../api/hooks";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

/** Nom posé par l'API : voir apps/api/src/plateforme/dossier-test.ts. */
const NOM_DEMONSTRATION = "Bastide Confection SARL — TEST";

/**
 * Charge le dossier de démonstration : une entreprise fictive complète, en
 * difficulté, pour essayer tous les écrans sur des chiffres qui font réagir
 * les alertes et le diagnostic.
 *
 * Visible des seuls rôles qui peuvent créer un dossier. Une fois chargé, on
 * l'ouvre au tableau de bord : c'est pour le regarder qu'on l'a demandé.
 */
export function BoutonDemonstration({ variante = "secondaire" }: { variante?: "principal" | "secondaire" }) {
  const { user } = useAuth();
  const { data: entites } = useEntities();
  const charger = useDossierDemonstration();
  const navigate = useNavigate();

  if (user?.role !== "ADMIN" && user?.role !== "DAF") return null;

  const present = entites?.some((e) => e.name === NOM_DEMONSTRATION) ?? false;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className={variante === "principal" ? "btn-primary" : "btn-secondary"}
        disabled={charger.isPending}
        title={
          present
            ? "Remet le dossier de démonstration dans son état d'origine : vos modifications sur ce dossier sont perdues."
            : "Ajoute une entreprise fictive complète, pour essayer tous les écrans."
        }
        onClick={() =>
          charger.mutate(undefined, {
            onSuccess: () => navigate("/tableau-de-bord"),
          })
        }
      >
        {charger.isPending
          ? "Chargement…"
          : present
            ? "Réinitialiser le dossier de démonstration"
            : "Charger le dossier de démonstration"}
      </button>
      {charger.isError && (
        <p role="alert" className="text-xs text-critical max-w-xs">
          {charger.error instanceof ApiError ? charger.error.message : "Le chargement a échoué."}
        </p>
      )}
    </div>
  );
}
