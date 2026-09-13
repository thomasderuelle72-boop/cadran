import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BasculeTheme } from "./BasculeTheme";
import type { Role } from "../api/types";

interface Entree {
  to: string;
  label: string;
  end?: boolean;
  roles?: Role[];
}

/**
 * Navigation groupée par ce que l'utilisateur cherche à faire, et non par
 * module technique.
 *
 * Les trois premières familles suivent l'échelle du conseil : constater où on
 * en est, comprendre pourquoi, puis agir. Douze entrées à plat obligeaient à
 * relire toute la liste pour trouver la bonne ; regroupées, elles se
 * parcourent par intention.
 */
const FAMILLES: Array<{ titre: string; entrees: Entree[] }> = [
  {
    titre: "Piloter",
    entrees: [
      { to: "/", label: "Tableau de bord", end: true },
      { to: "/ratios", label: "Ratios" },
      { to: "/budget", label: "Budget" },
      { to: "/cash", label: "Trésorerie" },
    ],
  },
  {
    titre: "Comprendre",
    entrees: [
      { to: "/analysis", label: "Analyse" },
      { to: "/receivables", label: "Encours" },
      { to: "/diagnostic", label: "Diagnostic" },
    ],
  },
  {
    titre: "Agir",
    entrees: [
      { to: "/actions", label: "Plan d'action" },
      { to: "/alerts", label: "Alertes" },
    ],
  },
  {
    titre: "Données",
    entrees: [
      { to: "/import", label: "Import" },
      { to: "/reports", label: "Rapports" },
      { to: "/settings", label: "Paramètres", roles: ["ADMIN", "DAF"] },
    ],
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
          // La marque suit les tokens : figée en cuivre, elle devenait un
          // corps étranger dès qu'on changeait de palette.
          background:
            "conic-gradient(from -90deg, rgb(var(--accent)) 0 25%, rgb(var(--surface-2)) 25% 100%)",
        }}
        aria-hidden="true"
      />
      <span className="font-display font-semibold text-lg leading-none">Cadran</span>
    </div>
  );
}

function IconeMenu({ ouvert }: { ouvert: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {ouvert ? (
        <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <path
          d="M3 5.5h14M3 10h14M3 14.5h14"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function Navigation({ role, onNavigate }: { role: Role | undefined; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto py-2 px-2" aria-label="Navigation principale">
      {FAMILLES.map((famille) => {
        const visibles = famille.entrees.filter(
          (entree) => !entree.roles || (role && entree.roles.includes(role))
        );
        if (visibles.length === 0) return null;

        return (
          <div key={famille.titre} className="mb-4 last:mb-0">
            <div className="px-3 mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink/35">
              {famille.titre}
            </div>
            <div className="flex flex-col gap-0.5">
              {visibles.map((entree) => (
                <NavLink
                  key={entree.to}
                  to={entree.to}
                  end={entree.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-primary-soft text-primary"
                        : "text-ink/70 hover:bg-ink/[0.04] hover:text-ink"
                    }`
                  }
                >
                  {entree.label}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const [tiroirOuvert, setTiroirOuvert] = useState(false);
  const { pathname } = useLocation();

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

  const pied = (
    <div className="px-4 py-4 border-t border-rule/10 text-xs space-y-3">
      <BasculeTheme />
      <div>
        <div className="font-medium text-ink/80">{user?.name}</div>
        <div className="text-ink/40 mb-2">{user?.role ? ROLE_LABELS[user.role] : ""}</div>
        <button onClick={logout} className="text-primary hover:underline">
          Se déconnecter
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Barre supérieure, seulement quand la latérale est repliée. */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 border-b border-rule/10 bg-surface">
        <button
          type="button"
          onClick={() => setTiroirOuvert(true)}
          className="-ml-1.5 p-1.5 rounded-lg text-ink/70 hover:bg-ink/5"
          aria-label="Ouvrir la navigation"
          aria-expanded={tiroirOuvert}
        >
          <IconeMenu ouvert={false} />
        </button>
        <Marque />
      </header>

      {/* Latérale fixe à partir de lg. */}
      <aside className="hidden lg:flex w-60 flex-none border-r border-rule/10 bg-surface flex-col h-screen sticky top-0">
        <div className="px-5 py-5 border-b border-rule/10">
          <Marque />
          <div className="text-xs text-ink/50 mt-1.5">{user?.organizationName}</div>
        </div>
        <Navigation role={user?.role} />
        {pied}
      </aside>

      {/* Tiroir en dessous de lg. */}
      {tiroirOuvert && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setTiroirOuvert(false)}
            aria-hidden="true"
          />
          <div className="relative w-[17rem] max-w-[85vw] bg-surface flex flex-col h-full shadow-xl">
            <div className="px-5 py-4 border-b border-rule/10 flex items-start justify-between gap-3">
              <div>
                <Marque />
                <div className="text-xs text-ink/50 mt-1.5">{user?.organizationName}</div>
              </div>
              <button
                type="button"
                onClick={() => setTiroirOuvert(false)}
                className="p-1.5 -mr-1.5 rounded-lg text-ink/60 hover:bg-ink/5"
                aria-label="Fermer la navigation"
              >
                <IconeMenu ouvert />
              </button>
            </div>
            <Navigation role={user?.role} onNavigate={() => setTiroirOuvert(false)} />
            {pied}
          </div>
        </div>
      )}

      {/*
        min-w-0 est nécessaire : sans lui, un tableau large impose sa largeur
        au conteneur flex et fait déborder la page entière au lieu de défiler
        dans son propre cadre.
      */}
      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="max-w-[1400px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
