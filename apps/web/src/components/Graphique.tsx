import { useEffect, useState } from "react";
import {
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "../lib/format";

/**
 * Couleurs de série, validées et non choisies.
 *
 * La couleur de marque (#1F5C4E) ne peut pas servir de couleur de série : sa
 * chroma est sous le plancher en dessous duquel un trait fin se lit comme du
 * gris. Les valeurs ci-dessous sont les plus proches qui passent les six
 * contrôles (bande de clarté, plancher de chroma, séparation en vision
 * déficiente, plancher en vision normale, contraste sur le fond).
 *
 * Une contrainte s'y attache. La séparation protanope du couple vert/cuivre
 * vaut ΔE 7,2, dans la bande plancher de 6 à 8 : elle n'est acceptable
 * *qu'accompagnée* d'un second encodage. C'est pourquoi ce composant impose
 * une légende et des étiquettes directes en bout de courbe — les retirer
 * rendrait le graphique illisible pour une partie des lecteurs, pas
 * seulement moins joli.
 */
export const SERIES = {
  clair: ["#00795C", "#A25E22"],
  sombre: ["#1E9B78", "#C4842F"],
} as const;

/**
 * Couleurs lues dans les tokens CSS plutôt que choisies ici.
 *
 * Recharts peint en SVG avec des attributs `stroke` et `fill` : une classe
 * Tailwind n'y arrive pas, et une couleur écrite en dur ne suit pas le
 * thème. Les valeurs ci-dessus restent la référence documentée ; index.css
 * les porte sous --serie-1 et --serie-2, une paire par thème, et ce hook les
 * relit à chaque bascule — au choix explicite comme au changement de réglage
 * système.
 */
function variable(nom: string, defaut: string): string {
  if (typeof window === "undefined") return defaut;
  const valeur = getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
  return valeur ? `rgb(${valeur})` : defaut;
}

export interface CouleursGraphique {
  series: string[];
  surface: string;
  encre: string;
  trait: string;
}

function lireCouleurs(): CouleursGraphique {
  return {
    series: [variable("--serie-1", SERIES.clair[0]), variable("--serie-2", SERIES.clair[1])],
    surface: variable("--surface", "#ffffff"),
    encre: variable("--ink", "#171F19"),
    trait: variable("--rule", "#171F19"),
  };
}

export function useCouleursGraphique(): CouleursGraphique {
  const [couleurs, setCouleurs] = useState<CouleursGraphique>(lireCouleurs);

  useEffect(() => {
    const relire = () => setCouleurs(lireCouleurs());
    // Deux attributs portent l'apparence, et il faut les deux : data-theme
    // pour le mode clair/sombre, data-palette pour la famille de couleurs.
    // N'observer que le premier laissait les courbes peintes aux couleurs de
    // la palette précédente après un changement de palette — le reste de la
    // page changeait, les graphiques non.
    const observateur = new MutationObserver(relire);
    observateur.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-palette"],
    });
    // …et le réglage « système » n'en pose aucun : il faut écouter l'OS.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", relire);
    relire();
    return () => {
      observateur.disconnect();
      media.removeEventListener("change", relire);
    };
  }, []);

  return couleurs;
}

export interface SerieGraphique {
  cle: string;
  label: string;
}

/** Abrège un montant pour un axe : 512 000 devient « 512 k ». */
export function abregerMontant(valeur: number): string {
  const absolu = Math.abs(valeur);
  if (absolu >= 1_000_000) return `${(valeur / 1_000_000).toFixed(absolu >= 10_000_000 ? 0 : 1)} M`;
  if (absolu >= 1_000) return `${Math.round(valeur / 1_000)} k`;
  return String(Math.round(valeur));
}

/**
 * Courbe multi-séries sur une même échelle.
 *
 * Volontairement sans second axe : deux échelles superposées permettent de
 * faire dire n'importe quoi à deux courbes, selon la façon dont on les cadre.
 * Deux grandeurs d'ordres différents demandent deux graphiques.
 */
export interface PointGraphique {
  [cle: string]: string | number | null;
}

export function CourbeTemporelle({
  donnees,
  series,
  cleAbscisse,
  currency = "EUR",
  hauteur = 260,
}: {
  donnees: PointGraphique[];
  series: SerieGraphique[];
  cleAbscisse: string;
  currency?: string;
  hauteur?: number;
}) {
  const dernierIndex = donnees.length - 1;
  const couleurs = useCouleursGraphique();

  return (
    <ResponsiveContainer width="100%" height={hauteur}>
      <LineChart data={donnees} margin={{ top: 8, right: 68, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="currentColor" className="text-ink/[0.08]" vertical={false} />
        <XAxis
          dataKey={cleAbscisse}
          tick={{ fontSize: 12, fill: "currentColor" }}
          className="text-ink/50"
          stroke="currentColor"
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "currentColor" }}
          className="text-ink/50"
          stroke="currentColor"
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(valeur) => abregerMontant(Number(valeur))}
        />
        <Tooltip
          formatter={(valeur, nom) => [formatCurrency(Number(valeur ?? 0), currency), nom]}
          contentStyle={{
            borderRadius: "0.5rem",
            border: `1px solid ${couleurs.trait}26`,
            background: couleurs.surface,
            color: couleurs.encre,
            fontSize: "0.8rem",
          }}
          itemStyle={{ color: couleurs.encre }}
          labelStyle={{ color: couleurs.encre }}
        />
        <Legend
          verticalAlign="top"
          align="left"
          height={28}
          iconType="plainline"
          wrapperStyle={{ fontSize: "0.8rem" }}
        />
        {series.map((serie, index) => (
          <Line
            key={serie.cle}
            type="monotone"
            dataKey={serie.cle}
            name={serie.label}
            stroke={couleurs.series[index % couleurs.series.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: couleurs.surface }}
            isAnimationActive={false}
          >
            {/*
              Étiquette directe au bout de la courbe, et sur ce seul point :
              c'est le second encodage qu'exige la marge de séparation du
              couple de couleurs, et ça évite au lecteur l'aller-retour vers
              la légende. Une étiquette par point serait illisible.
            */}
            <LabelList
              dataKey={serie.cle}
              content={(proprietes) => {
                const { index: position, x, y } = proprietes as {
                  index?: number;
                  x?: number | string;
                  y?: number | string;
                };
                if (position !== dernierIndex) return null;
                return (
                  <text
                    x={Number(x) + 9}
                    y={Number(y)}
                    dy={4}
                    fill={couleurs.series[index % couleurs.series.length]}
                    fontSize={11.5}
                    fontWeight={600}
                  >
                    {serie.label}
                  </text>
                );
              }}
            />
          </Line>
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
