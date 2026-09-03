// Métadonnées légères (id + libellé) pour peupler le sélecteur de ratio des
// règles d'alerte, sans dépendre d'un calcul de ratios déjà chargé ailleurs
// dans l'app. Les identifiants doivent rester synchronisés avec le moteur
// côté API (apps/api/src/ratios/engine.ts) — la valeur réelle est toujours
// calculée côté serveur.
export const RATIO_CATALOG: Array<{ id: string; label: string }> = [
  { id: "marge_brute", label: "Marge brute" },
  { id: "marge_ebitda", label: "Marge d'EBITDA" },
  { id: "marge_nette", label: "Marge nette" },
  { id: "roe", label: "ROE" },
  { id: "roce", label: "ROCE" },
  { id: "liquidite_generale", label: "Ratio de liquidité générale" },
  { id: "quick_ratio", label: "Quick ratio" },
  { id: "fonds_de_roulement", label: "Fonds de roulement" },
  { id: "bfr", label: "Besoin en fonds de roulement" },
  { id: "tresorerie_nette", label: "Trésorerie nette" },
  { id: "gearing", label: "Ratio d'endettement (gearing)" },
  { id: "autonomie_financiere", label: "Autonomie financière" },
  { id: "capacite_remboursement", label: "Capacité de remboursement" },
  { id: "couverture_interets", label: "Couverture des intérêts" },
  { id: "dso", label: "DSO — délai clients" },
  { id: "dpo", label: "DPO — délai fournisseurs" },
  { id: "dio", label: "DIO — rotation des stocks" },
  { id: "cycle_conversion_cash", label: "Cycle de conversion cash" },
  { id: "croissance_ca", label: "Croissance du CA" },
];
