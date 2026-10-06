import { useState } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "../api/client";
import { useQuitterAccesSupport } from "../api/hooks";
import { useAuth } from "../context/AuthContext";

/**
 * Bandeau permanent pendant un accès support.
 *
 * Il est voyant exprès. Un administrateur entré dans le dossier d'un client
 * voit exactement la même application que ce client : mêmes écrans, mêmes
 * couleurs, mêmes boutons. Rien, sans ce bandeau, ne distingue « je consulte
 * les chiffres d'un client » de « je consulte les miens » — et c'est dans
 * cette confusion qu'on saisit une écriture dans le mauvais dossier.
 *
 * Il rappelle aussi que l'accès est tracé. Ce n'est pas une menace : c'est la
 * contrepartie qui rend l'accès acceptable, et la rappeler à celui qui en
 * dispose vaut mieux que de la laisser dans une page de conditions.
 */
export function BandeauSupport() {
  const { user, refresh } = useAuth();
  const quitter = useQuitterAccesSupport();
  const navigate = useNavigate();
  const [erreur, setErreur] = useState<string | null>(null);

  if (!user?.support) return null;

  async function sortir() {
    setErreur(null);
    try {
      await quitter.mutateAsync();
      await refresh();
      navigate("/plateforme");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Sortie impossible — reconnectez-vous.");
    }
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2
                 bg-warning text-paper text-sm"
    >
      <span className="font-medium">Accès support</span>
      <span className="opacity-90">
        Vous consultez {user.organizationName}. Chaque action est inscrite dans la piste
        d&apos;audit de ce client.
      </span>
      <button
        type="button"
        onClick={sortir}
        disabled={quitter.isPending}
        className="ml-auto rounded px-2.5 py-1 bg-paper/20 hover:bg-paper/30 font-medium
                   disabled:opacity-60"
      >
        {quitter.isPending ? "Sortie…" : "Quitter"}
      </button>
      {erreur && <span className="w-full text-xs opacity-90">{erreur}</span>}
    </div>
  );
}
