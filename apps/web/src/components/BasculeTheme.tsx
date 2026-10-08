import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

/**
 * Clair, sombre, ou comme le système.
 *
 * « Système » n'est pas un défaut caché mais un choix explicite, et le plus
 * utile pour un outil qu'on garde ouvert toute la journée sur une machine qui
 * bascule seule au coucher du soleil.
 *
 * Le réglage s'écrit en attribut sur la racine, que les tokens CSS lisent
 * (cf. index.css) : aucun composant n'a besoin de savoir lequel est actif.
 *
 * Il y avait aussi un choix de palette, sur quatre. Il est retiré : il
 * occupait la moitié du pied de menu, débordait de son cadre, et chaque
 * palette devait être tenue lisible séparément.
 */

type Mode = "systeme" | "clair" | "sombre";

const CLE_MODE = "cadran.theme";
/** Ancienne clé de palette : effacée au démarrage, voir initialiserTheme. */
const CLE_PALETTE_RETIREE = "cadran.palette";

const MODES: Array<{ id: Mode; label: string; Icone: LucideIcon }> = [
  { id: "systeme", label: "Système", Icone: Monitor },
  { id: "clair", label: "Clair", Icone: Sun },
  { id: "sombre", label: "Sombre", Icone: Moon },
];

function lireMode(): Mode {
  try {
    const stocke = localStorage.getItem(CLE_MODE);
    if (stocke === "clair" || stocke === "sombre" || stocke === "systeme") return stocke;
  } catch {
    // Navigation privée, stockage bloqué : on retombe sur le système.
  }
  return "systeme";
}

function appliquer(mode: Mode) {
  const racine = document.documentElement;
  // Aucun attribut pour « système » : les tokens laissent alors
  // prefers-color-scheme décider.
  if (mode === "systeme") racine.removeAttribute("data-theme");
  else racine.setAttribute("data-theme", mode === "sombre" ? "dark" : "light");
}

/** Applique le choix mémorisé avant le premier rendu, pour éviter un flash. */
export function initialiserTheme() {
  appliquer(lireMode());
  /* Un navigateur qui avait choisi une palette garde sa clé ; plus rien ne
   * la lit, mais autant ne pas laisser traîner un réglage sans effet. */
  document.documentElement.removeAttribute("data-palette");
  try {
    localStorage.removeItem(CLE_PALETTE_RETIREE);
  } catch {
    // Sans stockage, il n'y a rien à effacer.
  }
}

export function BasculeTheme({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<Mode>(lireMode);

  useEffect(() => {
    appliquer(mode);
    try {
      localStorage.setItem(CLE_MODE, mode);
    } catch {
      // Le choix reste appliqué pour la session, simplement non mémorisé.
    }
  }, [mode]);

  return (
    <div className="flex gap-0.5 p-0.5 rounded-lg bg-ink/[0.06]" role="radiogroup" aria-label="Apparence">
      {MODES.map(({ id, label, Icone }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          aria-label={compact ? label : undefined}
          title={label}
          onClick={() => setMode(id)}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
            mode === id ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"
          }`}
        >
          <Icone size={14} strokeWidth={2} aria-hidden="true" />
          {!compact && label}
        </button>
      ))}
    </div>
  );
}
