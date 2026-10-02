import { TOURS_MAX } from "./outils";

/**
 * La boucle d'appels d'outils, isolée de l'API du modèle.
 *
 * Elle est séparée du service pour une raison simple : c'est du code à nous,
 * et la seule façon de le vérifier sans payer un modèle à chaque exécution
 * est de pouvoir lui substituer un répondeur. Les deux dépendances —
 * interroger le modèle, exécuter un outil — sont donc passées en paramètre.
 *
 * Ce qu'elle garantit, et que les tests vérifient : une borne dure sur le
 * nombre de tours, les résultats d'outils renvoyés en **un seul** message,
 * et la comptabilisation de tous les jetons même quand on n'aboutit pas.
 */

export interface DemandeOutil {
  id: string;
  nom: string;
  arguments: Record<string, unknown>;
}

export interface TourModele {
  /** Texte produit, vide quand le modèle n'a demandé que des outils. */
  texte: string;
  outils: DemandeOutil[];
  refus: boolean;
  jetons: { entree: number; sortie: number; cacheLu: number };
}

export interface ResultatOutilBoucle {
  id: string;
  contenu: unknown;
  erreur: boolean;
}

export interface SourceCitee {
  outil: string;
  arguments: Record<string, unknown>;
  erreur: boolean;
}

export interface Issue {
  texte: string;
  sources: SourceCitee[];
  consommation: { entree: number; sortie: number; cacheLu: number };
  tronquee: boolean;
  refusee: boolean;
}

export const TEXTE_REFUS =
  "Je ne peux pas traiter cette demande. Reformulez-la, ou écrivez-nous si elle vous paraît légitime.";

export const TEXTE_TRONQUE =
  "Je n'ai pas réussi à aboutir sur cette question. Essayez de la poser de façon plus précise, " +
  "par exemple en nommant la période ou l'entreprise concernée.";

export async function boucleConseil(options: {
  /** Un tour de modèle. Les résultats d'outils du tour précédent lui ont
   *  déjà été remis par `remettreResultats`. */
  interroger: () => Promise<TourModele>;
  /** Mémorise la réponse du modèle avant de lui rendre les résultats. */
  memoriser: (tour: TourModele) => void;
  remettreResultats: (resultats: ResultatOutilBoucle[]) => void;
  executer: (demande: DemandeOutil) => Promise<{ contenu: unknown; erreur: boolean }>;
  toursMax?: number;
}): Promise<Issue> {
  const toursMax = options.toursMax ?? TOURS_MAX;
  const sources: SourceCitee[] = [];
  const consommation = { entree: 0, sortie: 0, cacheLu: 0 };

  for (let tour = 0; tour < toursMax; tour += 1) {
    const reponse = await options.interroger();

    /* Comptés avant tout aiguillage : ces jetons sont facturés que la
     * réponse aboutisse, soit refusée, ou que la boucle s'arrête sur sa
     * borne. Les compter seulement en cas de succès sous-estimerait le
     * coût réel, qui est précisément ce qu'on cherche à mesurer. */
    consommation.entree += reponse.jetons.entree;
    consommation.sortie += reponse.jetons.sortie;
    consommation.cacheLu += reponse.jetons.cacheLu;

    if (reponse.refus) {
      return { texte: TEXTE_REFUS, sources, consommation, tronquee: false, refusee: true };
    }

    options.memoriser(reponse);

    if (reponse.outils.length === 0) {
      return { texte: reponse.texte, sources, consommation, tronquee: false, refusee: false };
    }

    /* Les outils d'un même tour sont indépendants et tous en lecture : les
     * exécuter en parallèle économise une latence visible à l'écran. */
    const resultats = await Promise.all(
      options.executer
        ? reponse.outils.map(async (demande) => {
            const resultat = await options.executer(demande);
            sources.push({
              outil: demande.nom,
              arguments: demande.arguments,
              erreur: resultat.erreur,
            });
            return { id: demande.id, contenu: resultat.contenu, erreur: resultat.erreur };
          })
        : []
    );

    /* Un seul appel, donc un seul message : répartir les résultats sur
     * plusieurs messages apprend au modèle à ne plus demander ses outils
     * en parallèle, et chaque tour supplémentaire est facturé. */
    options.remettreResultats(resultats);
  }

  return { texte: TEXTE_TRONQUE, sources, consommation, tronquee: true, refusee: false };
}
