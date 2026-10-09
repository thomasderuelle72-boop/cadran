// Métadonnées légères (id + libellé) pour peupler le sélecteur de ratio des
// règles d'alerte, sans dépendre d'un calcul de ratios déjà chargé ailleurs
// dans l'app. Les identifiants doivent rester synchronisés avec le moteur
// côté API (apps/api/src/ratios/engine.ts) — la valeur réelle est toujours
// calculée côté serveur.
export const RATIO_CATALOG: Array<{ id: string; label: string }> = [
  { id: "marge_brute", label: "Marge brute" },
  { id: "marge_ebitda", label: "Marge d'EBITDA" },
  { id: "marge_nette", label: "Marge nette" },
  { id: "roe", label: "Rentabilité des capitaux propres" },
  { id: "roce", label: "Rentabilité des capitaux employés" },
  { id: "liquidite_generale", label: "Liquidité générale" },
  { id: "quick_ratio", label: "Liquidité réduite (hors stocks)" },
  { id: "fonds_de_roulement", label: "Fonds de roulement" },
  { id: "bfr", label: "Besoin en fonds de roulement" },
  { id: "tresorerie_nette", label: "Trésorerie nette" },
  { id: "gearing", label: "Endettement (dettes financières / capitaux propres)" },
  { id: "autonomie_financiere", label: "Autonomie financière" },
  { id: "capacite_remboursement", label: "Capacité de remboursement" },
  { id: "couverture_interets", label: "Couverture des intérêts" },
  { id: "dso", label: "Délai de paiement des clients" },
  { id: "dpo", label: "Délai de paiement des fournisseurs" },
  { id: "dio", label: "Durée de stockage" },
  { id: "cycle_conversion_cash", label: "Cycle de trésorerie" },
  { id: "croissance_ca", label: "Croissance du chiffre d'affaires" },
];
