/**
 * Catalogue des outils offerts au modèle.
 *
 * Chaque outil correspond à une capacité que Cadran possède déjà et qu'un
 * écran affiche. Le modèle n'a accès à rien d'autre : pas de SQL, pas de
 * requête libre, pas d'accès au grand livre brut autrement que par le
 * détail d'un compte.
 *
 * Deux propriétés tiennent la sécurité, et elles ne sont pas dans ce
 * fichier : toutes les méthodes de service appelées prennent
 * `organizationId` en premier paramètre et filtrent dessus, et cet
 * identifiant vient du jeton de session, jamais d'un argument produit par le
 * modèle. Un modèle qui inventerait l'identifiant d'une entreprise d'un
 * autre client obtiendrait une erreur « introuvable », pas des données.
 *
 * Les définitions sont séparées de leur exécution pour être vérifiables sans
 * modèle ni base : un schéma mal formé se voit en test, pas en production.
 */

export interface DefinitionOutil {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
    additionalProperties: false;
  };
  /**
   * Validation stricte des arguments par l'API. Sans elle, un argument
   * manquant arrive jusqu'à l'exécution et produit une erreur de service
   * là où un refus en amont est plus clair et moins coûteux.
   */
  strict: true;
}

/** Fabrique un schéma sans paramètre, verbeux à écrire à la main. */
function sansParametre(): DefinitionOutil["input_schema"] {
  return { type: "object", properties: {}, required: [], additionalProperties: false };
}

const ID_ENTITE = {
  type: "string",
  description: "Identifiant de l'entreprise, tel que donné par lister_entreprises.",
} as const;

const ID_PERIODE = {
  type: "string",
  description: "Identifiant de la période, tel que donné par lister_periodes.",
} as const;

const SENS = {
  type: "string",
  description: "CLIENT pour ce qu'on vous doit, FOURNISSEUR pour ce que vous devez.",
  enum: ["CLIENT", "FOURNISSEUR"],
};

export const OUTILS: DefinitionOutil[] = [
  {
    name: "lister_entreprises",
    description:
      "Les entreprises suivies par cette organisation, avec leur devise et leur secteur. " +
      "À appeler en premier quand la question ne désigne pas clairement une entreprise.",
    input_schema: sansParametre(),
    strict: true,
  },
  {
    name: "lister_periodes",
    description:
      "Les périodes comptables disponibles pour une entreprise, de la plus ancienne à la plus " +
      "récente. Nécessaire pour obtenir l'identifiant d'une période avant toute analyse datée.",
    input_schema: {
      type: "object",
      properties: { entrepriseId: ID_ENTITE },
      required: ["entrepriseId"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "soldes_intermediaires",
    description:
      "Soldes intermédiaires de gestion d'une période : chiffre d'affaires, valeur ajoutée, " +
      "excédent brut d'exploitation, résultat d'exploitation, résultat net, capacité " +
      "d'autofinancement, et le partage de la valeur ajoutée entre salariés, État, prêteurs et " +
      "entreprise. Chaque solde est accompagné de sa part du chiffre d'affaires.",
    input_schema: {
      type: "object",
      properties: { periodeId: ID_PERIODE },
      required: ["periodeId"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "flux_tresorerie",
    description:
      "Tableau de flux de trésorerie d'une période, par la méthode indirecte : flux " +
      "d'exploitation (capacité d'autofinancement et variation du besoin en fonds de roulement), " +
      "d'investissement, de financement, et la trésorerie d'ouverture et de clôture. " +
      "Répond à « d'où vient l'argent » et « où est-il parti ».",
    input_schema: {
      type: "object",
      properties: { periodeId: ID_PERIODE },
      required: ["periodeId"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "diagnostic_fragilite",
    description:
      "Scores de fragilité d'une période : Z' d'Altman et score de Conan & Holder, avec leurs " +
      "composantes, leurs seuils, leur zone, et les limites de chaque modèle. Ces scores " +
      "mesurent une structure de bilan ; ils ne voient ni la trésorerie à court terme, ni la " +
      "concentration du portefeuille client.",
    input_schema: {
      type: "object",
      properties: { periodeId: ID_PERIODE },
      required: ["periodeId"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "encours_et_retards",
    description:
      "Balance âgée à une date : encours total, part déjà en retard, âge moyen pondéré, " +
      "répartition par tranche d'ancienneté, et le détail par tiers avec son âge maximal. " +
      "C'est l'outil des questions de délai de paiement et de risque d'impayé.",
    input_schema: {
      type: "object",
      properties: {
        entrepriseId: ID_ENTITE,
        sens: SENS,
      },
      required: ["entrepriseId", "sens"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "concentration",
    description:
      "Répartition du chiffre d'affaires (ou des achats) entre les tiers : part du premier, des " +
      "trois premiers, des dix premiers, et indice de Herfindahl. Répond aux questions de " +
      "dépendance commerciale.",
    input_schema: {
      type: "object",
      properties: {
        entrepriseId: ID_ENTITE,
        sens: SENS,
      },
      required: ["entrepriseId", "sens"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "tendance",
    description:
      "Série des périodes d'une entreprise : chiffre d'affaires, excédent brut d'exploitation, " +
      "taux de marge, résultat net et trésorerie nette, période par période. À utiliser pour " +
      "toute question d'évolution, de saisonnalité ou de comparaison dans le temps.",
    input_schema: {
      type: "object",
      properties: { entrepriseId: ID_ENTITE },
      required: ["entrepriseId"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "detail_compte",
    description:
      "Écritures d'un compte du grand livre pour une entreprise, avec leurs totaux. Sert à " +
      "répondre à « de quoi est fait ce montant ». Exige un numéro de compte d'au moins deux " +
      "chiffres : un préfixe plus court ramènerait le grand livre entier.",
    input_schema: {
      type: "object",
      properties: {
        entrepriseId: ID_ENTITE,
        compte: {
          type: "string",
          description:
            "Préfixe de compte du plan comptable général, deux chiffres au minimum. " +
            "Exemples : 411 pour les clients, 60 pour les achats, 641 pour les salaires.",
        },
      },
      required: ["entrepriseId", "compte"],
      additionalProperties: false,
    },
    strict: true,
  },
];

export const NOMS_OUTILS = OUTILS.map((o) => o.name);

export function outilConnu(nom: string): boolean {
  return NOMS_OUTILS.includes(nom);
}

/**
 * Nombre maximal d'allers-retours avec le modèle pour une question.
 *
 * Une borne est nécessaire : un modèle qui boucle sur des appels d'outils
 * consomme sans produire, et la facture n'est pas plafonnée par ailleurs.
 * Six tours couvrent largement la question la plus composée du catalogue
 * (entreprises, périodes, puis trois analyses croisées).
 */
export const TOURS_MAX = 6;
