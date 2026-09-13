import { useEffect, useState } from "react";

/**
 * Choix d'apparence : une palette et un mode, sur deux axes indépendants.
 *
 * Les croiser en un seul réglage aurait donné six valeurs (trois palettes ×
 * deux modes, plus « système »), à tenir en correspondance à chaque ajout.
 * Séparés, on choisit sa famille de couleurs sans perdre son mode, et
 * inversement.
 *
 * « Système » n'est pas un défaut caché mais un choix explicite, et le plus
 * utile pour un outil qu'on garde ouvert toute la journée sur une machine qui
 * bascule seule au coucher du soleil.
 *
 * Les deux réglages s'écrivent en attributs sur la racine, que les tokens CSS
 * lisent (cf. index.css) : aucun composant n'a besoin de savoir lequel est
 * actif.
 */

type Mode = "systeme" | "clair" | "sombre";
type Palette = "cadran" | "registre" | "ardoise";

const CLE_MODE = "cadran.theme";
const CLE_PALETTE = "cadran.palette";

const MODES: Record<Mode, string> = {
  systeme: "Système",
  clair: "Clair",
  sombre: "Sombre",
};

const PALETTES: Array<{ id: Palette; label: string; description: string }> = [
  { id: "cadran", label: "Cadran", description: "Vert profond et cuivre, sur papier crème." },
  { id: "registre", label: "Registre", description: "Encre bleue et oxblood, angles vifs." },
  { id: "ardoise", label: "Ardoise", description: "Gris froid et indigo, formes adoucies." },
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

function lirePalette(): Palette {
  try {
    const stocke = localStorage.getItem(CLE_PALETTE);
    if (stocke === "cadran" || stocke === "registre" || stocke === "ardoise") return stocke;
  } catch {
    // Idem : la palette par défaut habille la page sans stockage.
  }
  return "cadran";
}

function appliquer(mode: Mode, palette: Palette) {
  const racine = document.documentElement;

  // Aucun attribut pour « système » : les tokens laissent alors
  // prefers-color-scheme décider.
  if (mode === "systeme") racine.removeAttribute("data-theme");
  else racine.setAttribute("data-theme", mode === "sombre" ? "dark" : "light");

  // Aucun attribut non plus pour la palette par défaut. Ce n'est pas un
  // détail : les règles sombres de Cadran portent :not([data-palette]), et
  // poser data-palette="cadran" les désactiverait — le sombre reviendrait
  // silencieusement au clair.
  if (palette === "cadran") racine.removeAttribute("data-palette");
  else racine.setAttribute("data-palette", palette);
}

/** Applique les choix mémorisés avant le premier rendu, pour éviter un flash. */
export function initialiserTheme() {
  appliquer(lireMode(), lirePalette());
}

function Segments<T extends string>({
  valeur,
  options,
  onChoisir,
  etiquette,
}: {
  valeur: T;
  options: Array<{ id: T; label: string; titre?: string }>;
  onChoisir: (id: T) => void;
  etiquette: string;
}) {
  return (
    <div
      className="flex gap-0.5 p-0.5 rounded-lg bg-ink/[0.05]"
      role="radiogroup"
      aria-label={etiquette}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={valeur === option.id}
          title={option.titre}
          onClick={() => onChoisir(option.id)}
          className={`flex-1 rounded-[0.3rem] px-2 py-1 text-[0.7rem] font-medium transition ${
            valeur === option.id ? "bg-surface text-ink shadow-sm" : "text-ink/50 hover:text-ink/80"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function BasculeTheme() {
  const [mode, setMode] = useState<Mode>(lireMode);
  const [palette, setPalette] = useState<Palette>(lirePalette);

  useEffect(() => {
    appliquer(mode, palette);
    try {
      localStorage.setItem(CLE_MODE, mode);
      localStorage.setItem(CLE_PALETTE, palette);
    } catch {
      // Les choix restent appliqués pour la session, simplement non mémorisés.
    }
  }, [mode, palette]);

  return (
    <div className="space-y-1.5">
      <Segments
        valeur={palette}
        etiquette="Palette de l'interface"
        options={PALETTES.map((p) => ({ id: p.id, label: p.label, titre: p.description }))}
        onChoisir={setPalette}
      />
      <Segments
        valeur={mode}
        etiquette="Mode clair ou sombre"
        options={(Object.keys(MODES) as Mode[]).map((id) => ({ id, label: MODES[id] }))}
        onChoisir={setMode}
      />
    </div>
  );
}
