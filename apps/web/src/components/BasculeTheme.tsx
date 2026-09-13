import { useEffect, useState } from "react";

/**
 * Bascule de thème à trois états, et non deux.
 *
 * « Système » n'est pas un état par défaut caché : c'est un choix explicite,
 * et le plus utile pour un outil qu'on garde ouvert toute la journée sur une
 * machine qui bascule seule au coucher du soleil. Les deux autres forcent le
 * thème quel que soit le réglage du système.
 *
 * Le choix est marqué par un attribut data-theme sur la racine, que les
 * tokens CSS lisent (cf. index.css) : aucun composant n'a besoin de savoir
 * quel thème est actif.
 */

type Theme = "systeme" | "clair" | "sombre";

const CLE = "cadran.theme";

const LIBELLES: Record<Theme, string> = {
  systeme: "Système",
  clair: "Clair",
  sombre: "Sombre",
};

function lireChoix(): Theme {
  try {
    const stocke = localStorage.getItem(CLE);
    if (stocke === "clair" || stocke === "sombre" || stocke === "systeme") return stocke;
  } catch {
    // Navigation privée, stockage bloqué : on retombe sur le système.
  }
  return "systeme";
}

function appliquer(theme: Theme) {
  const racine = document.documentElement;
  // Aucun attribut pour « système » : les tokens laissent alors
  // prefers-color-scheme décider.
  if (theme === "systeme") racine.removeAttribute("data-theme");
  else racine.setAttribute("data-theme", theme === "sombre" ? "dark" : "light");
}

/** Applique le choix mémorisé avant le premier rendu, pour éviter un flash. */
export function initialiserTheme() {
  appliquer(lireChoix());
}

export function BasculeTheme() {
  const [theme, setTheme] = useState<Theme>(lireChoix);

  useEffect(() => {
    appliquer(theme);
    try {
      localStorage.setItem(CLE, theme);
    } catch {
      // Le thème reste appliqué pour la session, simplement non mémorisé.
    }
  }, [theme]);

  return (
    <div
      className="flex gap-0.5 p-0.5 rounded-lg bg-ink/[0.05]"
      role="radiogroup"
      aria-label="Thème de l'interface"
    >
      {(Object.keys(LIBELLES) as Theme[]).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={theme === option}
          onClick={() => setTheme(option)}
          className={`flex-1 rounded-[0.3rem] px-2 py-1 text-[0.7rem] font-medium transition ${
            theme === option ? "bg-surface text-ink shadow-sm" : "text-ink/50 hover:text-ink/80"
          }`}
        >
          {LIBELLES[option]}
        </button>
      ))}
    </div>
  );
}
