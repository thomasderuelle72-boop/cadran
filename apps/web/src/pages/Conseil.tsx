import { useRef, useState } from "react";
import { Link } from "react-router";
import { ApiError } from "../api/client";
import {
  type ReponseConseil,
  type SourceConseil,
  useEtatConseil,
  usePoserQuestion,
} from "../api/hooks";

/**
 * Le conseiller.
 *
 * Deux partis pris à l'écran, et ils découlent du même principe.
 *
 * Les outils consultés sont affichés sous chaque réponse. Ce n'est pas de la
 * décoration technique : la promesse du produit est que le modèle n'invente
 * aucun chiffre, et montrer d'où il les tire est la seule façon de rendre
 * cette promesse vérifiable par celui qui lit.
 *
 * Le quota restant est visible en permanence. Un compteur qu'on découvre au
 * moment du refus donne le sentiment d'une limite cachée.
 */

/** Noms d'outils tels qu'un dirigeant les comprend. */
const LIBELLES: Record<string, string> = {
  lister_entreprises: "Vos entreprises",
  lister_periodes: "Périodes disponibles",
  soldes_intermediaires: "Soldes intermédiaires de gestion",
  flux_tresorerie: "Flux de trésorerie",
  diagnostic_fragilite: "Diagnostic de fragilité",
  encours_et_retards: "Encours et retards de paiement",
  concentration: "Concentration du portefeuille",
  tendance: "Évolution période par période",
  detail_compte: "Détail d'un compte",
};

const EXEMPLES = [
  "Ma trésorerie est-elle en bonne santé ?",
  "Qu'est-ce qui me menace le plus aujourd'hui ?",
  "Quel mois a été le plus mauvais, et pourquoi ?",
  "Mes clients me paient-ils dans les délais ?",
];

interface Echange {
  question: string;
  reponse: ReponseConseil | null;
  erreur: string | null;
}

function Sources({ sources }: { sources: SourceConseil[] }) {
  if (sources.length === 0) return null;
  return (
    <details className="mt-3 border-t border-rule/10 pt-2">
      <summary className="text-xs text-ink-3 cursor-pointer hover:text-ink-2">
        Calculs consultés ({sources.length})
      </summary>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {sources.map((source, index) => (
          <li
            key={`${source.outil}-${index}`}
            className={`text-xs px-2 py-1 rounded border ${
              source.erreur
                ? "border-warning/40 text-warning bg-warning-soft"
                : "border-rule/20 text-ink-3 bg-surface-2"
            }`}
          >
            {LIBELLES[source.outil] ?? source.outil}
            {source.erreur && " — indisponible"}
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-3 mt-2">
        Chaque chiffre cité provient de ces calculs, les mêmes que ceux des autres écrans. Le
        conseiller ne calcule rien lui-même.
      </p>
    </details>
  );
}

export function ConseilPage() {
  const { data: etat, isLoading } = useEtatConseil();
  const poser = usePoserQuestion();
  const [question, setQuestion] = useState("");
  const [echanges, setEchanges] = useState<Echange[]>([]);
  const champ = useRef<HTMLTextAreaElement>(null);

  async function envoyer(texte: string) {
    const propre = texte.trim();
    if (propre.length < 5 || poser.isPending) return;

    setEchanges((precedents) => [...precedents, { question: propre, reponse: null, erreur: null }]);
    setQuestion("");

    try {
      const reponse = await poser.mutateAsync(propre);
      setEchanges((precedents) =>
        precedents.map((e, i) => (i === precedents.length - 1 ? { ...e, reponse } : e))
      );
    } catch (erreur) {
      const message =
        erreur instanceof ApiError
          ? erreur.message
          : "La réponse n'a pas abouti. Réessayez dans un instant.";
      setEchanges((precedents) =>
        precedents.map((e, i) => (i === precedents.length - 1 ? { ...e, erreur: message } : e))
      );
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="h-7 w-40 rounded bg-surface-2 animate-pulse" />
        <div className="h-24 rounded bg-surface-2 animate-pulse" />
      </div>
    );
  }

  const epuise = etat !== undefined && etat.restantes <= 0;
  const utilisable = etat?.disponible === true && !epuise;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.65rem] leading-tight font-bold">Conseiller</h1>
          <p className="text-sm text-ink-3 mt-1">
            Posez une question sur vos chiffres. La réponse s&apos;appuie sur les calculs de
            Cadran, jamais sur une estimation.
          </p>
        </div>
        {etat && etat.disponible && (
          <p className="text-sm text-ink-3 tabular-nums whitespace-nowrap">
            {etat.restantes} / {etat.incluses} questions ce mois-ci
          </p>
        )}
      </div>

      {etat && !etat.disponible && (
        <div className="card border-warning/40 bg-warning-soft">
          <p className="font-medium text-sm">Conseiller non activé</p>
          <p className="text-sm text-ink-2 mt-1">
            Cette fonctionnalité n&apos;est pas active sur cette instance. Les analyses restent
            accessibles depuis les autres écrans.
          </p>
        </div>
      )}

      {epuise && etat?.disponible && (
        <div className="card border-warning/40 bg-warning-soft">
          <p className="font-medium text-sm">Questions épuisées pour ce mois</p>
          <p className="text-sm text-ink-2 mt-1">
            Votre formule « {etat.formule} » en inclut {etat.incluses} par mois. Le compteur repart
            le 1er du mois prochain ; une{" "}
            <Link to="/abonnement" className="text-primary hover:underline">
              formule supérieure
            </Link>{" "}
            en inclut davantage.
          </p>
        </div>
      )}

      {echanges.length === 0 && utilisable && (
        <div className="card">
          <p className="label mb-2">Pour commencer</p>
          <div className="flex flex-col gap-2">
            {EXEMPLES.map((exemple) => (
              <button
                key={exemple}
                type="button"
                className="text-left text-sm border border-rule/15 rounded px-3 py-2 hover:border-primary hover:bg-surface-2 transition"
                onClick={() => void envoyer(exemple)}
              >
                {exemple}
              </button>
            ))}
          </div>
        </div>
      )}

      {echanges.length > 0 && (
        <div className="space-y-5">
          {echanges.map((echange, index) => (
            <div key={index} className="space-y-3">
              <p className="text-sm font-medium bg-primary-soft border border-primary/20 rounded-lg px-3 py-2 inline-block max-w-full">
                {echange.question}
              </p>

              {echange.reponse === null && echange.erreur === null && (
                <p className="text-sm text-ink-3">Consultation de vos chiffres…</p>
              )}

              {echange.erreur && <p className="text-sm text-critical">{echange.erreur}</p>}

              {echange.reponse && (
                <div className="card">
                  {/* Le texte arrive en paragraphes : on les respecte plutôt
                      que d'interpréter du balisage qu'on n'a pas demandé. */}
                  <div className="space-y-3 text-[15px] leading-relaxed">
                    {echange.reponse.texte.split(/\n{2,}/).map((paragraphe, i) => (
                      <p key={i} className="whitespace-pre-wrap">
                        {paragraphe}
                      </p>
                    ))}
                  </div>
                  {echange.reponse.tronquee && (
                    <p className="text-xs text-warning mt-3">
                      La recherche s&apos;est arrêtée avant d&apos;aboutir. Précisez la période ou
                      l&apos;entreprise concernée.
                    </p>
                  )}
                  <Sources sources={echange.reponse.sources} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {utilisable && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void envoyer(question);
          }}
        >
          <label className="label" htmlFor="conseil-question">
            Votre question
          </label>
          <textarea
            id="conseil-question"
            ref={champ}
            className="input min-h-[5rem] resize-y"
            maxLength={1000}
            value={question}
            placeholder="Par exemple : pourquoi ma marge a-t-elle baissé au dernier trimestre ?"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              /* Entrée envoie, Maj+Entrée va à la ligne : c'est l'usage
                 attendu d'un champ de conversation. */
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void envoyer(question);
              }
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-3">
              Entrée pour envoyer, Maj + Entrée pour aller à la ligne.
            </p>
            <button
              type="submit"
              className="btn-primary"
              disabled={poser.isPending || question.trim().length < 5}
            >
              {poser.isPending ? "Réflexion…" : "Poser la question"}
            </button>
          </div>
        </form>
      )}

      <p className="text-xs text-ink-3 border-t border-rule/10 pt-3">
        Le conseiller n&apos;est ni expert-comptable, ni conseil juridique ou fiscal. Il éclaire vos
        décisions ; elles restent les vôtres. Vos questions et les chiffres consultés sont transmis
        à un modèle d&apos;analyse de langage, sous-traitant déclaré dans notre{" "}
        <Link to="/confidentialite" className="text-primary hover:underline">
          politique de confidentialité
        </Link>
        .
      </p>
    </div>
  );
}
