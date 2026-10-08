import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import type { RatioUnit } from "../api/types";
import { formatRatioValue } from "../lib/format";

/**
 * Couleurs de série, lues dans les jetons CSS plutôt que choisies ici.
 *
 * Recharts peint en SVG avec des attributs `stroke` et `fill` : une classe
 * Tailwind n'y arrive pas, et une couleur écrite en dur ne suit pas le thème.
 * Les valeurs vivent donc dans index.css, où elles sont documentées avec le
 * résultat du validateur, et ce hook les relit à chaque bascule — au choix
 * explicite comme au changement de réglage système.
 *
 * Quatre teintes catégorielles, et pas une de plus : c'est ce que la
 * validation laisse passer. Au-delà, deux séries deviennent indiscernables
 * en vision déficiente, et les blocs refusent la cinquième plutôt que de la
 * peindre d'une couleur inventée.
 *
 * La séparation de la pire paire tombe dans la bande plancher (ΔE 6–8) :
 * elle n'est admise qu'accompagnée d'un second encodage. C'est pourquoi ces
 * composants imposent une légende dès deux séries, des étiquettes directes
 * jusqu'à quatre, et un filet de fond entre les aplats empilés. Les retirer
 * rendrait les graphiques illisibles pour une partie des lecteurs, pas
 * seulement moins jolis.
 */
function variable(nom: string, defaut: string): string {
  if (typeof window === "undefined") return defaut;
  const valeur = getComputedStyle(document.documentElement)
    .getPropertyValue(nom)
    .trim();
  return valeur ? `rgb(${valeur})` : defaut;
}

function liste(nom: string, defaut: string[]): string[] {
  if (typeof window === "undefined") return defaut;
  const valeur = getComputedStyle(document.documentElement)
    .getPropertyValue(nom)
    .trim();
  if (!valeur) return defaut;
  return valeur.split(",").map((part) => `rgb(${part.trim()})`);
}

export interface CouleursGraphique {
  series: string[];
  /** Dégradé d'une seule teinte, pour les compositions empilées. */
  rampe: string[];
  surface: string;
  encre: string;
  trait: string;
  /** Couleurs d'état, réservées à ce qui est bon ou mauvais : jamais une série. */
  succes: string;
  critique: string;
}

function lireCouleurs(): CouleursGraphique {
  return {
    series: [
      variable("--serie-1", "#009E73"),
      variable("--serie-2", "#966512"),
      variable("--serie-3", "#0072B2"),
      variable("--serie-4", "#CC79A7"),
    ],
    rampe: liste("--serie-rampe", [
      "#C7E7DC",
      "#9BD3C2",
      "#6BBCA4",
      "#3FA285",
      "#1C8768",
      "#0A6B51",
    ]),
    surface: variable("--surface", "#ffffff"),
    encre: variable("--ink", "#171F19"),
    trait: variable("--rule", "#171F19"),
    succes: variable("--success", "#177050"),
    critique: variable("--critical", "#AD3D2E"),
  };
}

export function useCouleursGraphique(): CouleursGraphique {
  const [couleurs, setCouleurs] = useState<CouleursGraphique>(lireCouleurs);

  useEffect(() => {
    const relire = () => setCouleurs(lireCouleurs());
    // Le choix explicite clair/sombre s'écrit dans data-theme.
    const observateur = new MutationObserver(relire);
    observateur.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
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
  unite?: RatioUnit;
}

export interface PointGraphique {
  [cle: string]: string | number | null | boolean;
}

/** Abrège un montant pour un axe : 512 000 devient « 512 k ». */
export function abregerMontant(valeur: number): string {
  const absolu = Math.abs(valeur);
  if (absolu >= 1_000_000)
    return `${(valeur / 1_000_000).toFixed(absolu >= 10_000_000 ? 0 : 1)} M`;
  if (absolu >= 1_000) return `${Math.round(valeur / 1_000)} k`;
  return String(Math.round(valeur));
}

/** Graduation d'axe adaptée à l'unité : un pourcentage n'est pas un montant. */
function graduation(unite: RatioUnit): (valeur: number) => string {
  switch (unite) {
    case "pourcentage":
      return (valeur) => `${(valeur * 100).toFixed(0)} %`;
    case "jours":
      return (valeur) => `${Math.round(valeur)} j`;
    case "annees":
      return (valeur) => `${valeur.toFixed(1)}`;
    case "devise":
      return (valeur) => abregerMontant(valeur);
    default:
      return (valeur) => valeur.toFixed(1);
  }
}

/** Habillage commun du survol : il doit exister sur toute forme tracée. */
function useInfobulle(unite: RatioUnit, currency: string) {
  const couleurs = useCouleursGraphique();
  return {
    formatter: (valeur: unknown, nom: unknown) => [
      formatRatioValue(
        valeur === null ? null : Number(valeur),
        unite,
        currency,
      ),
      String(nom),
    ],
    contentStyle: {
      borderRadius: "0.5rem",
      border: `1px solid ${couleurs.trait}26`,
      background: couleurs.surface,
      color: couleurs.encre,
      fontSize: "0.8rem",
    },
    itemStyle: { color: couleurs.encre },
    labelStyle: { color: couleurs.encre },
  };
}

/** Largeur approchée d'un caractère à 11,5 px, demi-gras, police d'interface. */
const LARGEUR_CARACTERE = 7.2;

/** Pas du dégradé pour la n-ième part, le dernier servant à tout ce qui dépasse. */
function rampe(couleurs: CouleursGraphique, index: number): string {
  return couleurs.rampe[Math.min(index, couleurs.rampe.length - 1)];
}

/** Sans étiquette directe, il reste à loger la dernière graduation d'abscisse. */
const MARGE_DROITE_NUE = 24;

/** Part de la largeur du bloc qu'on accepte de céder aux étiquettes. */
const PART_ETIQUETTES = 0.32;

/**
 * Étiquettes directes : en entier, ou pas du tout.
 *
 * Elles existent pour épargner au lecteur l'aller-retour vers la légende.
 * « Besoin en fonds de roulem… » le lui impose quand même, tout en mangeant
 * un tiers du tracé : c'est le pire des deux mondes. Quand les libellés ne
 * tiennent pas dans la place disponible — ce qui arrive vite en demi-largeur
 * avec des intitulés comptables français — on rend le tracé au graphique et
 * la légende, toujours présente, porte seule l'identité des séries.
 *
 * Le calcul demande la largeur réelle du bloc, que seul le rendu connaît :
 * d'où la mesure plutôt qu'un seuil écrit à la main.
 */
/**
 * Écart vertical minimal entre deux étiquettes, en part de l'amplitude de
 * l'axe.
 *
 * Une étiquette occupe environ 14 px ; le tracé d'un bloc en fait 200. En
 * deçà de 7 % de l'amplitude, deux séries qui finissent au même niveau
 * écrivent leurs noms l'un sur l'autre.
 */
const ECART_VERTICAL_MIN = 0.07;

/** Les séries se terminent-elles trop près les unes des autres ? */
function finissentAuMemeNiveau(
  series: SerieGraphique[],
  donnees: PointGraphique[],
): boolean {
  if (donnees.length === 0) return false;

  const toutes = donnees.flatMap((point) =>
    series
      .map((serie) => point[serie.cle])
      .filter((v): v is number => typeof v === "number"),
  );
  if (toutes.length === 0) return false;

  const amplitude = Math.max(...toutes) - Math.min(...toutes);
  if (amplitude === 0) return series.length > 1;

  const fins = series
    .map((serie) => donnees[donnees.length - 1][serie.cle])
    .filter((v): v is number => typeof v === "number")
    .sort((a, b) => a - b);

  return fins.some(
    (valeur, index) =>
      index > 0 && (valeur - fins[index - 1]) / amplitude < ECART_VERTICAL_MIN,
  );
}

function etiquettesDirectes(
  series: SerieGraphique[],
  largeur: number,
  donnees: PointGraphique[],
): { directes: boolean; marge: number } {
  const plusLong = series.reduce(
    (max, serie) => Math.max(max, serie.label.length),
    0,
  );
  const besoin = plusLong * LARGEUR_CARACTERE + 16;

  /*
   * Deux conditions, et la même conclusion : en entier ou pas du tout.
   *
   * La largeur ne suffit pas. Sur une société en difficulté, l'EBITDA et le
   * résultat net finissent à quelques milliers d'euros l'un de l'autre : les
   * deux étiquettes s'écrivent l'une sur l'autre et on ne lit plus ni l'une ni
   * l'autre. Le cas s'est présenté sur le dossier de test, et nulle part
   * ailleurs — c'est bien pour cela qu'un dossier d'essai doit être en
   * difficulté. La légende, toujours présente, porte alors seule l'identité.
   */
  const directes =
    largeur > 0 &&
    besoin <= largeur * PART_ETIQUETTES &&
    !finissentAuMemeNiveau(series, donnees);

  return { directes, marge: directes ? besoin : MARGE_DROITE_NUE };
}

/** Largeur rendue d'un conteneur, observée plutôt que supposée. */
function useLargeur(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observateur = new ResizeObserver(([entree]) => {
      setLargeur(entree.contentRect.width);
    });
    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  return [ref, largeur];
}

/**
 * Hauteur réservée à la légende.
 *
 * Elle passe à la ligne dès trois séries dans un bloc en demi-largeur, et une
 * hauteur figée la faisait alors chevaucher la première graduation de l'axe.
 */
function hauteurLegende(series: number): number {
  return series >= 3 ? 46 : 28;
}

const MARGE = { top: 8, bottom: 4, left: 4 };

function Axes({
  cleAbscisse,
  unite,
}: {
  cleAbscisse: string;
  unite: RatioUnit;
}) {
  return (
    <>
      <CartesianGrid
        stroke="currentColor"
        className="text-ink/[0.08]"
        vertical={false}
      />
      <XAxis
        dataKey={cleAbscisse}
        tick={{ fontSize: 12, fill: "currentColor" }}
        className="text-ink-3"
        stroke="currentColor"
        tickLine={false}
      />
      <YAxis
        tick={{ fontSize: 12, fill: "currentColor" }}
        className="text-ink-3"
        stroke="currentColor"
        tickLine={false}
        axisLine={false}
        width={56}
        tickFormatter={(valeur) => graduation(unite)(Number(valeur))}
      />
    </>
  );
}

/**
 * Légende écrite à la main, pour deux raisons.
 *
 * L'ordre d'abord : laissée à elle-même, la bibliothèque rendait « DIO, DPO,
 * DSO » devant des barres dessinées DSO, DPO, DIO. Les couleurs restaient
 * justes, mais un lecteur qui lit la légende de gauche à droite et la
 * rapporte aux barres dans le même ordre se trompait de série.
 *
 * La couleur du texte ensuite : la légende par défaut peint l'intitulé à la
 * teinte de la série. Un texte coloré se lit moins bien qu'un texte à la
 * couleur du texte, et l'identité est déjà portée par la pastille à côté.
 */
function LegendeHaute({
  series,
  couleurs,
  icone = "trait",
}: {
  series: SerieGraphique[];
  couleurs: CouleursGraphique;
  icone?: "trait" | "pave";
}) {
  return (
    <Legend
      verticalAlign="top"
      align="left"
      height={hauteurLegende(series.length)}
      content={() => (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 pl-1 text-[0.8rem] text-ink-2">
          {series.map((serie, index) => (
            <li key={serie.cle} className="flex items-center gap-1.5">
              <span
                aria-hidden
                style={{ background: couleurs.series[index] }}
                className={
                  icone === "trait"
                    ? "inline-block h-0.5 w-4 rounded-full"
                    : "inline-block h-2.5 w-2.5 rounded-sm"
                }
              />
              {serie.label}
            </li>
          ))}
        </ul>
      )}
    />
  );
}

/**
 * Courbe multi-séries sur une même échelle.
 *
 * Volontairement sans second axe : deux échelles superposées permettent de
 * faire dire n'importe quoi à deux courbes, selon la façon dont on les cadre.
 * Deux grandeurs d'ordres différents demandent deux graphiques — et le
 * serveur refuse la configuration qui les mêlerait.
 */
export function CourbeTemporelle({
  donnees,
  series,
  cleAbscisse,
  currency = "EUR",
  unite = "devise",
  hauteur = 260,
}: {
  donnees: PointGraphique[];
  series: SerieGraphique[];
  cleAbscisse: string;
  currency?: string;
  unite?: RatioUnit;
  hauteur?: number;
}) {
  const dernierIndex = donnees.length - 1;
  const couleurs = useCouleursGraphique();
  const infobulle = useInfobulle(unite, currency);
  const [conteneur, largeur] = useLargeur();
  const { directes, marge } = etiquettesDirectes(series, largeur, donnees);

  return (
    <div ref={conteneur}>
      <ResponsiveContainer width="100%" height={hauteur}>
        <LineChart data={donnees} margin={{ ...MARGE, right: marge }}>
          <Axes cleAbscisse={cleAbscisse} unite={unite} />
          <Tooltip {...infobulle} />
          {series.length > 1 && (
            <LegendeHaute series={series} couleurs={couleurs} />
          )}
          {series.map((serie, index) => (
            <Line
              key={serie.cle}
              type="monotone"
              dataKey={serie.cle}
              name={serie.label}
              stroke={couleurs.series[index]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: couleurs.surface }}
              isAnimationActive={false}
              connectNulls={false}
            >
              {/*
              Étiquette directe au bout de la courbe, et sur ce seul point :
              c'est le second encodage qu'exige la marge de séparation des
              couleurs, et ça évite au lecteur l'aller-retour vers la légende.
              Une étiquette par point serait illisible.
            */}
              {directes && (
                <LabelList
                  dataKey={serie.cle}
                  content={(proprietes) => {
                    const {
                      index: position,
                      x,
                      y,
                    } = proprietes as {
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
                        fill="currentColor"
                        className="text-ink-2"
                        fontSize={11.5}
                        fontWeight={600}
                      >
                        {serie.label}
                      </text>
                    );
                  }}
                />
              )}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Aires sur une même échelle : une trajectoire, et le volume qu'elle porte.
 *
 * La même chose que la courbe, avec un lavis à 10 % sous chaque trait : il
 * fait voir l'ordre de grandeur (le chiffre d'affaires porte l'EBITDA) sans
 * masquer les graduations. Un aplat plus soutenu ferait de chaque série un
 * bloc, et la seconde cacherait la première.
 */
export function AiresTemporelles({
  donnees,
  series,
  cleAbscisse,
  currency = "EUR",
  unite = "devise",
  hauteur = 260,
}: {
  donnees: PointGraphique[];
  series: SerieGraphique[];
  cleAbscisse: string;
  currency?: string;
  unite?: RatioUnit;
  hauteur?: number;
}) {
  const dernierIndex = donnees.length - 1;
  const couleurs = useCouleursGraphique();
  const infobulle = useInfobulle(unite, currency);
  const [conteneur, largeur] = useLargeur();
  const { directes, marge } = etiquettesDirectes(series, largeur, donnees);

  return (
    <div ref={conteneur}>
      <ResponsiveContainer width="100%" height={hauteur}>
        <AreaChart data={donnees} margin={{ ...MARGE, right: marge }}>
          <Axes cleAbscisse={cleAbscisse} unite={unite} />
          <Tooltip {...infobulle} />
          {series.length > 1 && <LegendeHaute series={series} couleurs={couleurs} />}
          {series.map((serie, index) => (
            <Area
              key={serie.cle}
              type="monotone"
              dataKey={serie.cle}
              name={serie.label}
              stroke={couleurs.series[index]}
              strokeWidth={2}
              fill={couleurs.series[index]}
              fillOpacity={0.1}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: couleurs.surface }}
              animationDuration={700}
              connectNulls={false}
            >
              {directes && (
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
                      <text x={Number(x) + 9} y={Number(y)} dy={4} fill="currentColor" className="text-ink-2" fontSize={11.5} fontWeight={600}>
                        {serie.label}
                      </text>
                    );
                  }}
                />
              )}
            </Area>
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Barres groupées : comparer quelques exercices entre eux.
 *
 * La forme change par rapport à la courbe parce que la question change. Une
 * courbe raconte une trajectoire continue ; des barres comparent des
 * quantités discrètes — ce qu'est un exercice comptable.
 */
export function BarresComparees({
  donnees,
  series,
  cleAbscisse,
  currency = "EUR",
  unite = "devise",
  hauteur = 260,
}: {
  donnees: PointGraphique[];
  series: SerieGraphique[];
  cleAbscisse: string;
  currency?: string;
  unite?: RatioUnit;
  hauteur?: number;
}) {
  const couleurs = useCouleursGraphique();
  const infobulle = useInfobulle(unite, currency);

  return (
    <ResponsiveContainer width="100%" height={hauteur}>
      <BarChart
        data={donnees}
        margin={{ ...MARGE, right: 12 }}
        barGap={2}
        barCategoryGap="22%"
      >
        <Axes cleAbscisse={cleAbscisse} unite={unite} />
        <Tooltip
          {...infobulle}
          cursor={{ fill: "currentColor", className: "text-ink/[0.04]" }}
        />
        {series.length > 1 && (
          <LegendeHaute series={series} couleurs={couleurs} icone="pave" />
        )}
        {series.map((serie, index) => (
          <Bar
            key={serie.cle}
            dataKey={serie.cle}
            name={serie.label}
            fill={couleurs.series[index]}
            // Extrémité arrondie côté donnée, ancrée sur la ligne de base.
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Barres empilées : la composition d'un tout.
 *
 * Un dégradé d'une seule teinte, et non des couleurs catégorielles : les
 * segments sont des parts d'un même ensemble, et des teintes distinctes
 * laisseraient croire à des grandeurs sans rapport. Un filet de la couleur du
 * fond sépare les segments — sans lui, deux pas voisins du dégradé se
 * touchent et la frontière disparaît.
 */
export function BarresEmpilees({
  donnees,
  series,
  cleAbscisse,
  currency = "EUR",
  unite = "devise",
  hauteur = 260,
}: {
  donnees: PointGraphique[];
  series: SerieGraphique[];
  cleAbscisse: string;
  currency?: string;
  unite?: RatioUnit;
  hauteur?: number;
}) {
  const couleurs = useCouleursGraphique();
  const infobulle = useInfobulle(unite, currency);
  const dernier = series.length - 1;

  return (
    <ResponsiveContainer width="100%" height={hauteur}>
      <BarChart
        data={donnees}
        margin={{ ...MARGE, right: 12 }}
        barCategoryGap="28%"
      >
        <Axes cleAbscisse={cleAbscisse} unite={unite} />
        <Tooltip
          {...infobulle}
          cursor={{ fill: "currentColor", className: "text-ink/[0.04]" }}
        />
        <LegendeHaute
          series={series}
          couleurs={{
            ...couleurs,
            series: series.map((_, index) => rampe(couleurs, index)),
          }}
          icone="pave"
        />
        {series.map((serie, index) => (
          <Bar
            key={serie.cle}
            dataKey={serie.cle}
            name={serie.label}
            stackId="composition"
            fill={rampe(couleurs, index)}
            stroke={couleurs.surface}
            strokeWidth={2}
            // Seul le segment de tête est arrondi : arrondir les autres
            // creuserait des encoches au milieu de la pile.
            radius={index === dernier ? [4, 4, 0, 0] : 0}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
