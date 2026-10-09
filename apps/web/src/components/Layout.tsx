import { useEffect, useId, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import {
  Award,
  Bell,
  BriefcaseBusiness,
  ChartSpline,
  ChartColumn,
  ChevronsUpDown,
  CreditCard,
  FileText,
  HandCoins,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  LogOut,
  Menu,
  MessageCircleQuestion,
  Settings,
  Scale,
  ShieldCheck,
  Stethoscope,
  Target,
  TrendingUp,
  Upload,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { BasculeTheme } from "./BasculeTheme";
import { BandeauSupport } from "./BandeauSupport";
import { SelecteurDossier } from "./SelecteurDossier";
import type { Role } from "../api/types";
import { useAlertEvents, useEntities, useEtatConseil } from "../api/hooks";
import { useDossierCourant } from "../lib/dossierCourant";

interface Entree {
  to: string;
  label: string;
  Icone: LucideIcon;
  /** Ce que l'écran répond, en une ligne : affiché au survol. */
  aide: string;
  roles?: Role[];
  /** Réservé aux administrateurs de la plateforme. */
  plateforme?: boolean;
  /**
   * Affichée seulement à partir de deux dossiers. Un dirigeant qui suit sa
   * seule entreprise n'a pas de portefeuille : lui en montrer un d'une ligne
   * ajouterait un écran sans rien lui apprendre.
   */
  plusieursDossiers?: boolean;
  /** Porte le nombre d'alertes non traitées. */
  compteurAlertes?: boolean;
  /** Affichée seulement si le conseiller est activé sur cette instance. */
  conseiller?: boolean;
}

/**
 * Navigation en trois étages : le cabinet, le dossier, les données.
 *
 * L'ancien menu mêlait des écrans qui parlent de tous les dossiers (alertes,
 * plan d'action) et des écrans qui parlent du dossier choisi en haut
 * (tableau de bord, diagnostic) : on ne savait jamais de quoi parlait la page
 * ouverte. Désormais :
 * - « Cabinet » : ce qui porte sur tous les dossiers ;
 * - le bloc du dossier, titré de son nom : comprendre ses chiffres, puis
 *   prévoir ;
 * - « Données » : ce qu'on importe et ce qu'on exporte.
 *
 * Les libellés disent ce qu'on trouve derrière, dans les mots d'un dirigeant
 * autant que d'un comptable. Chaque entrée a son icône, qui se reconnaît
 * avant de se lire, et une aide au survol. Ce qui règle le compte plutôt que
 * les chiffres — paramètres, abonnement, console — est dans le pied de menu.
 */
interface Famille {
  titre: string;
  entrees: Entree[];
}

const CABINET: Famille = {
  titre: "Cabinet",
  entrees: [
    {
      to: "/portefeuille",
      label: "Portefeuille",
      Icone: BriefcaseBusiness,
      aide: "Tous les dossiers, du plus urgent au plus sain",
      plusieursDossiers: true,
    },
    {
      to: "/opportunites",
      label: "Missions à proposer",
      Icone: Lightbulb,
      aide: "Ce que les chiffres de chaque dossier appellent, chiffré en euros",
    },
    { to: "/actions", label: "Plan d'action", Icone: ListChecks, aide: "Les mesures décidées et leur suivi, dossier par dossier" },
    {
      to: "/valeur-creee",
      label: "Valeur créée",
      Icone: Award,
      aide: "Ce que les actions menées ont rapporté aux clients",
    },
    {
      to: "/alerts",
      label: "Alertes",
      Icone: Bell,
      aide: "Les seuils franchis, à traiter",
      compteurAlertes: true,
    },
  ],
};

const DOSSIER: Famille[] = [
  {
    titre: "Comprendre",
    entrees: [
      {
        to: "/tableau-de-bord",
        label: "Synthèse",
        Icone: LayoutDashboard,
        aide: "Où en est le dossier, en un écran",
      },
      {
        to: "/analysis",
        label: "Activité et résultat",
        Icone: ChartColumn,
        aide: "Du chiffre d'affaires au résultat net, et le partage de la valeur ajoutée",
      },
      {
        to: "/bilan",
        label: "Bilan et trésorerie",
        Icone: Scale,
        aide: "Le bilan en grandes masses, d'où vient la trésorerie, le besoin en fonds de roulement, les flux",
      },
      {
        to: "/evolution",
        label: "Évolution",
        Icone: TrendingUp,
        aide: "Les derniers exercices côte à côte : activité, rentabilité, structure, trésorerie",
      },
      {
        to: "/diagnostic",
        label: "Diagnostic",
        Icone: Stethoscope,
        aide: "Les indicateurs, le seuil de rentabilité, la comparaison au secteur, les scores",
      },
      {
        to: "/receivables",
        label: "Clients et fournisseurs",
        Icone: HandCoins,
        aide: "Qui doit quoi, et depuis combien de temps",
      },
      {
        to: "/conseil",
        label: "Conseiller",
        Icone: MessageCircleQuestion,
        aide: "Poser une question sur les chiffres du dossier",
        conseiller: true,
      },
    ],
  },
  {
    titre: "Prévoir",
    entrees: [
      {
        to: "/previsionnel",
        label: "Prévisionnel",
        Icone: ChartSpline,
        aide: "Les trois prochains exercices et le plan de financement",
      },
      { to: "/cash", label: "Trésorerie", Icone: Wallet, aide: "La trésorerie semaine par semaine" },
      { to: "/budget", label: "Budget", Icone: Target, aide: "Le budget et l'écart au réalisé" },
    ],
  },
];

const DONNEES: Famille = {
  titre: "Données",
  entrees: [
    { to: "/import", label: "Importer", Icone: Upload, aide: "Charger un FEC ou une balance" },
    { to: "/reports", label: "Rapports", Icone: FileText, aide: "Les documents à télécharger ou envoyer" },
  ],
};

/** Le compte, pas les chiffres : en pied de menu. */
const COMPTE: Entree[] = [
  {
    to: "/settings",
    label: "Paramètres",
    Icone: Settings,
    aide: "Dossiers, utilisateurs et règles d'alerte",
    roles: ["ADMIN", "DAF"],
  },
  { to: "/abonnement", label: "Abonnement", Icone: CreditCard, aide: "Formule et facturation" },
  {
    to: "/plateforme",
    label: "Plateforme",
    Icone: ShieldCheck,
    aide: "Console d'exploitation de Cadran",
    plateforme: true,
  },
];

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  DAF: "Directeur financier",
  CONTROLEUR: "Contrôleur de gestion",
  LECTEUR: "Lecteur",
};

function Marque() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="w-7 h-7 rounded-full flex-none"
        style={{
          background:
            "conic-gradient(from -90deg, rgb(var(--accent)) 0 25%, rgb(var(--surface-2)) 25% 100%)",
        }}
        aria-hidden="true"
      />
      <span className="font-display font-bold text-lg leading-none tracking-tight">Cadran</span>
    </div>
  );
}

function Lien({ entree, compteur, onNavigate }: { entree: Entree; compteur?: number; onNavigate?: () => void }) {
  const { Icone } = entree;
  return (
    <NavLink
      to={entree.to}
      onClick={onNavigate}
      title={entree.aide}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-[5px] text-sm transition ${
          isActive
            ? "bg-primary-soft text-primary font-semibold"
            : "text-ink-2 font-medium hover:bg-ink/[0.05] hover:text-ink"
        }`
      }
    >
      <Icone size={18} strokeWidth={1.9} aria-hidden="true" className="flex-none" />
      <span className="flex-1 truncate">{entree.label}</span>
      {compteur !== undefined && compteur > 0 && (
        <span
          className="min-w-[1.4rem] px-1.5 rounded-full bg-critical text-surface text-xs font-semibold text-center leading-5"
          aria-label={`${compteur} à traiter`}
        >
          {compteur > 99 ? "99+" : compteur}
        </span>
      )}
    </NavLink>
  );
}

function Groupe({
  famille,
  visible,
  aTraiter,
  onNavigate,
  sousTitre = false,
}: {
  famille: Famille;
  visible: (entree: Entree) => boolean;
  aTraiter: number;
  onNavigate?: () => void;
  sousTitre?: boolean;
}) {
  const entrees = famille.entrees.filter(visible);
  if (entrees.length === 0) return null;
  return (
    <div>
      <div className={`px-3 mb-1 text-xs font-semibold ${sousTitre ? "text-ink-3/90" : "text-ink-3"}`}>{famille.titre}</div>
      <div className="flex flex-col gap-0.5">
        {entrees.map((entree) => (
          <Lien
            key={entree.to}
            entree={entree}
            compteur={entree.compteurAlertes ? aTraiter : undefined}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const { data: entites } = useEntities();
  const { data: alertes } = useAlertEvents();
  const { data: conseil } = useEtatConseil();
  const [entityId] = useDossierCourant(entites);
  const dossier = entites?.find((e) => e.id === entityId);
  const plusieursDossiers = (entites?.length ?? 0) > 1;
  /* Pendant un accès support, l'entrée Plateforme disparaît : on
   * n'administre pas la plateforme depuis le dossier d'un client, et le garde
   * du serveur refuse d'ailleurs ces requêtes. */
  const estExploitant = user?.administrateurPlateforme === true && user.support === false;
  // Une règle franchie sur plusieurs périodes d'un même dossier compte pour
  // une alerte, comme sur la page Alertes.
  const aTraiter = new Set(
    alertes?.filter((a) => !a.acknowledged).map((a) => `${a.entity?.id ?? "-"}|${a.rule.id}`),
  ).size;

  const visible = (entree: Entree) =>
    (!entree.roles || (user?.role !== undefined && entree.roles.includes(user.role))) &&
    (!entree.plateforme || estExploitant) &&
    (!entree.plusieursDossiers || plusieursDossiers) &&
    (!entree.conseiller || conseil?.disponible === true);

  return (
    <>
      <nav className="flex-1 overflow-y-auto px-3 py-2.5 space-y-3" aria-label="Navigation principale">
        {/* Un dirigeant qui suit sa seule entreprise n'a pas de cabinet : le
            même groupe s'appelle alors « Suivi ». */}
        <Groupe
          famille={{ ...CABINET, titre: plusieursDossiers ? "Cabinet" : "Suivi" }}
          visible={visible}
          aTraiter={aTraiter}
          onNavigate={onNavigate}
        />

        {/* Le dossier choisi en haut, et tout ce qui parle de lui. */}
        <div className="rounded-xl bg-ink/[0.035] p-1.5 space-y-2.5" aria-label={dossier ? `Dossier ${dossier.name}` : "Dossier"}>
          <div className="px-2 pt-1">
            <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink-3">Dossier</div>
            <div className="text-sm font-bold truncate" title={dossier?.name}>
              {dossier?.name ?? "Aucun dossier"}
            </div>
          </div>
          {DOSSIER.map((famille) => (
            <Groupe
              key={famille.titre}
              famille={famille}
              visible={visible}
              aTraiter={aTraiter}
              onNavigate={onNavigate}
              sousTitre
            />
          ))}
        </div>

        <Groupe famille={DONNEES} visible={visible} aTraiter={aTraiter} onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-rule/10 p-3">
        <Compte entrees={COMPTE.filter(visible)} onNavigate={onNavigate} />
      </div>
    </>
  );
}

function initiales(nom: string | undefined): string {
  if (!nom) return "";
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toLocaleUpperCase("fr"))
    .join("");
}

/**
 * Le compte : qui est connecté, et ce qui le règle.
 *
 * Paramètres, abonnement, apparence et déconnexion tenaient en permanence au
 * pied du menu, sur près de deux cents pixels : sur un écran d'ordinateur
 * portable, ils repoussaient la moitié des écrans d'analyse sous la ligne de
 * flottaison. On s'en sert rarement ; ils s'ouvrent au clic sur son nom,
 * comme dans la plupart des logiciels.
 */
function Compte({ entrees, onNavigate }: { entrees: Entree[]; onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const cadre = useRef<HTMLDivElement>(null);
  const idPanneau = useId();
  const { pathname } = useLocation();

  useEffect(() => setOuvert(false), [pathname]);

  // Un clic ailleurs ou Échap referme, comme tout panneau superposé.
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (cadre.current && !cadre.current.contains(e.target as Node)) setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", clic);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("mousedown", clic);
      document.removeEventListener("keydown", touche);
    };
  }, [ouvert]);

  return (
    <div className="relative" ref={cadre}>
      {ouvert && (
        <div
          id={idPanneau}
          className="absolute bottom-full left-0 w-72 max-w-[calc(100vw-2rem)] mb-2 rounded-xl border border-rule/15 bg-surface shadow-lg p-2 space-y-2 z-50"
        >
          {entrees.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {entrees.map((entree) => (
                <Lien key={entree.to} entree={entree} onNavigate={onNavigate} />
              ))}
            </div>
          )}
          <div className="px-1">
            <div className="px-2 mb-1 text-xs font-semibold text-ink-3">Apparence</div>
            <BasculeTheme />
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-critical hover:bg-critical-soft transition"
          >
            <LogOut size={18} aria-hidden="true" />
            Se déconnecter
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        aria-controls={idPanneau}
        className="w-full flex items-center gap-3 rounded-lg p-1.5 text-left hover:bg-ink/[0.05] transition"
      >
        <span
          className="w-9 h-9 flex-none rounded-full bg-primary-soft text-primary grid place-items-center text-sm font-bold"
          aria-hidden="true"
        >
          {initiales(user?.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold truncate">{user?.name}</span>
          <span className="block text-xs text-ink-3 truncate">
            {[user?.role ? ROLE_LABELS[user.role] : null, user?.organizationName].filter(Boolean).join(" · ")}
          </span>
        </span>
        <ChevronsUpDown size={16} className="flex-none text-ink-3" aria-hidden="true" />
        <span className="sr-only">Compte, paramètres et déconnexion</span>
      </button>
    </div>
  );
}

/* L'organisation est dite au pied du menu, sous le nom de l'utilisateur :
 * ici, elle prenait une ligne de plus à un menu qui en manque. */
function EnTeteMenu() {
  return (
    <div className="px-4 pt-5 pb-1 min-w-0">
      <Marque />
    </div>
  );
}

export function Layout() {
  const [tiroirOuvert, setTiroirOuvert] = useState(false);
  const { pathname } = useLocation();
  const { user } = useAuth();

  // Un changement de page referme le tiroir : sur téléphone, il recouvre le
  // contenu qu'on vient d'aller chercher.
  useEffect(() => setTiroirOuvert(false), [pathname]);

  // Échap referme, comme tout panneau superposé.
  useEffect(() => {
    if (!tiroirOuvert) return;
    const fermer = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTiroirOuvert(false);
    };
    window.addEventListener("keydown", fermer);
    return () => window.removeEventListener("keydown", fermer);
  }, [tiroirOuvert]);

  return (
    <div className="min-h-screen lg:flex">
      {/* Barre supérieure, seulement quand la latérale est repliée. */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 border-b border-rule/10 bg-surface">
        <button
          type="button"
          onClick={() => setTiroirOuvert(true)}
          className="-ml-1.5 p-2 rounded-lg text-ink-2 hover:bg-ink/5"
          aria-label="Ouvrir le menu"
          aria-expanded={tiroirOuvert}
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <Marque />
        <div className="ml-auto min-w-0 max-w-[55%]">
          <SelecteurDossier compact />
        </div>
      </header>

      {/* Latérale fixe à partir de lg. */}
      <aside className="hidden lg:flex w-64 flex-none border-r border-rule/10 bg-surface flex-col h-screen sticky top-0">
        <EnTeteMenu />
        <Navigation />
      </aside>

      {/* Tiroir en dessous de lg. */}
      {tiroirOuvert && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setTiroirOuvert(false)} aria-hidden="true" />
          <div className="relative w-[18rem] max-w-[85vw] bg-surface flex flex-col h-full shadow-xl">
            <div className="flex items-start justify-between">
              <EnTeteMenu />
              <button
                type="button"
                onClick={() => setTiroirOuvert(false)}
                className="m-3 p-2 rounded-lg text-ink-2 hover:bg-ink/5"
                aria-label="Fermer le menu"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <Navigation onNavigate={() => setTiroirOuvert(false)} />
          </div>
        </div>
      )}

      {/*
        min-w-0 est nécessaire : sans lui, un tableau large impose sa largeur
        au conteneur flex et fait déborder la page entière au lieu de défiler
        dans son propre cadre.
      */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/*
          Hors du <main> et collants en haut, ensemble : le bandeau d'accès
          support doit rester visible quand on fait défiler un tableau de deux
          cents lignes, et la barre de contexte dit de quelle organisation et
          de quel dossier on lit les chiffres — c'est aussi là qu'on change de
          dossier. Collés séparément, l'un glissait sous l'autre.
        */}
        <div className="sticky top-0 z-30">
          <BandeauSupport />
          <div className="hidden lg:flex items-center gap-2 h-14 px-10 border-b border-rule/10 bg-surface/80 backdrop-blur-md">
            <span className="text-sm text-ink-3 truncate max-w-[16rem]" title={user?.organizationName}>
              {user?.organizationName}
            </span>
            <span className="text-ink-3" aria-hidden="true">
              /
            </span>
            <SelecteurDossier />
          </div>
        </div>
        <main className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
          {/* Rejoué à chaque changement d'écran : la page arrive, au lieu de
              remplacer l'autre d'un coup. */}
          <div key={pathname} className="max-w-[1320px] mx-auto apparition">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
