// Métadonnées légères (id + libellé) pour peupler le sélecteur de ratio des
// règles d'alerte, sans dépendre d'un calcul de ratios déjà chargé ailleurs
// dans l'app. Les identifiants doivent rester synchronisés avec le moteur
// côté API (apps/api/src/ratios/engine.ts) — la valeur réelle est toujours
// calculée côté serveur.
import type { RatioUnit } from "../api/types";

/** L'unité sert à saisir un seuil et à lire une valeur : « 20 % », pas « 0,2 ». */
export const RATIO_CATALOG: Array<{ id: string; label: string; unite: RatioUnit }> = [
  { id: "marge_brute", label: "Marge brute", unite: "pourcentage" },
  { id: "marge_ebitda", label: "Marge d'EBITDA", unite: "pourcentage" },
  { id: "marge_nette", label: "Marge nette", unite: "pourcentage" },
  { id: "roe", label: "Rentabilité des capitaux propres", unite: "pourcentage" },
  { id: "roce", label: "Rentabilité des capitaux employés", unite: "pourcentage" },
  { id: "liquidite_generale", label: "Liquidité générale", unite: "ratio" },
  { id: "quick_ratio", label: "Liquidité réduite (hors stocks)", unite: "ratio" },
  { id: "fonds_de_roulement", label: "Fonds de roulement", unite: "devise" },
  { id: "bfr", label: "Besoin en fonds de roulement", unite: "devise" },
  { id: "tresorerie_nette", label: "Trésorerie nette", unite: "devise" },
  { id: "gearing", label: "Endettement (dettes financières / capitaux propres)", unite: "ratio" },
  { id: "autonomie_financiere", label: "Autonomie financière", unite: "pourcentage" },
  { id: "capacite_remboursement", label: "Capacité de remboursement", unite: "annees" },
  { id: "couverture_interets", label: "Couverture des intérêts", unite: "ratio" },
  { id: "dso", label: "Délai de paiement des clients", unite: "jours" },
  { id: "dpo", label: "Délai de paiement des fournisseurs", unite: "jours" },
  { id: "dio", label: "Durée de stockage", unite: "jours" },
  { id: "cycle_conversion_cash", label: "Cycle de trésorerie", unite: "jours" },
  { id: "croissance_ca", label: "Croissance du chiffre d'affaires", unite: "pourcentage" },
];
