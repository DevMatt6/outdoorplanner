import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { NotificationBell } from "./NotificationBell";

export const BackofficeLayout = ({ title, links, children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-60 shrink-0 bg-[#020617] text-white flex flex-col min-h-screen sticky top-0 max-h-screen">
        <Link to="/" className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-700">
          <span className="bg-white text-[#0A3D91] font-heading font-extrabold px-1.5 py-0.5 text-sm">OP</span>
          <span className="font-heading font-bold text-sm">Outdoor Planner</span>
        </Link>
        <div className="px-5 py-4 border-b border-slate-700">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{title}</div>
          <div className="text-sm font-semibold mt-0.5 truncate">{user?.nome}</div>
        </div>
        <nav className="flex-1 py-3">
          {links.map(([to, label, testid]) => {
            const active = location.pathname === to;
            return (
              <Link key={to} to={to} data-testid={testid}
                className={`block px-5 py-2.5 text-sm font-semibold border-l-4 transition-colors
                  ${active ? "border-[#0033FF] bg-slate-800 text-white" : "border-transparent text-slate-300 hover:text-white hover:bg-slate-800"}`}>
                {label}
              </Link>
            );
          })}
        </nav>
        <button data-testid="backoffice-logout" onClick={() => { logout(); navigate("/"); }}
          className="px-5 py-4 text-left text-sm font-semibold text-slate-400 hover:text-white border-t border-slate-700 transition-colors">
          Esci
        </button>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="h-16 bg-white border-b border-slate-900 flex items-center justify-end px-6 sticky top-0 z-[1100]">
          <NotificationBell />
        </div>
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export const COMUNE_LINKS = [
  ["/comune", "Scrivania pratiche", "link-scrivania"],
  ["/comune/spazi", "Catalogo spazi", "link-spazi"],
  ["/comune/form", "Modulo dinamico", "link-form"],
  ["/comune/report", "Report & incassi", "link-report"],
  ["/comune/profilo", "Profilo & tariffe", "link-profilo"],
];

export const ADMIN_LINKS = [
  ["/admin", "Dashboard KPI", "link-kpi"],
  ["/admin/comuni", "Comuni", "link-comuni"],
  ["/admin/monitor", "Monitor anomalie", "link-monitor"],
];
