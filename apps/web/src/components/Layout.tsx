import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Tableau de bord", end: true },
  { to: "/ratios", label: "Ratios" },
  { to: "/import", label: "Import" },
  { to: "/reports", label: "Rapports" },
  { to: "/settings", label: "Paramètres", adminOnly: true },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 flex-none border-r border-black/10 bg-white flex flex-col">
        <div className="px-5 py-5 border-b border-black/10">
          <div className="flex items-center gap-2">
            <span
              className="w-6 h-6 rounded-full flex-none"
              style={{ background: "conic-gradient(from -90deg, #9C5F26 0 25%, #E5E7DD 25% 100%)" }}
            />
            <span className="font-display font-semibold text-lg">Cadran</span>
          </div>
          <div className="text-xs text-ink/50 mt-1">{user?.organizationName}</div>
        </div>
        <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5">
          {NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "ADMIN").map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-primary-soft text-primary" : "text-ink/70 hover:bg-black/5"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-black/10 text-xs">
          <div className="font-medium text-ink/80">{user?.name}</div>
          <div className="text-ink/40 mb-2">{user?.role}</div>
          <button onClick={logout} className="text-primary hover:underline">
            Se déconnecter
          </button>
        </div>
      </aside>
      <main className="flex-1 px-8 py-8 max-w-6xl">
        <Outlet />
      </main>
    </div>
  );
}
