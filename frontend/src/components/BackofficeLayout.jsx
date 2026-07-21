import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { api, imgSrc } from "../lib/api";
import { NotificationBell } from "./NotificationBell";
import { LayoutGrid, Inbox, Map, FileSliders, ChartColumn, Settings, LogOut, Landmark, Radar } from "lucide-react";

const ICONS = {
  "link-scrivania": Inbox,
  "link-spazi": Map,
  "link-form": FileSliders,
  "link-report": ChartColumn,
  "link-profilo": Settings,
  "link-kpi": LayoutGrid,
  "link-comuni": Landmark,
  "link-monitor": Radar,
};

export const BackofficeLayout = ({ title, links, children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const livello = user?.livello || 1;
  const [comuneInfo, setComuneInfo] = useState(null);
  useEffect(() => {
    if (user?.ruolo === "comune") api.get("/comune/profilo").then(({ data }) => setComuneInfo(data));
  }, [user?.ruolo]);
  const visibleLinks = links.filter((l) => !l[3] || livello >= l[3]);
  const livelloLabel = user?.ruolo === "comune"
    ? (livello === 3 ? "Responsabile · L3" : livello === 2 ? "Referente · L2" : "Operatore · L1")
    : null;

  return (
    <div className="min-h-screen bg-[#F2F3F0] flex p-4 gap-4">
      <aside className="w-64 shrink-0 bg-white rounded-2xl border border-slate-100 flex flex-col sticky top-4 max-h-[calc(100vh-2rem)]">
        <Link to="/" className="flex items-center gap-3 px-6 h-16 border-b border-slate-100">
          <span className="bg-[#2F5B41] text-white font-heading font-extrabold w-8 h-8 rounded-full flex items-center justify-center text-xs">OP</span>
          <span className="font-heading font-extrabold text-sm">Outdoor Planner</span>
        </Link>
        <div className="px-6 py-4 border-b border-slate-100">
          {comuneInfo && (
            <div className="flex items-center gap-2 mb-2" data-testid="comune-logo-sidebar">
              {comuneInfo.logo_url && <img src={imgSrc(comuneInfo.logo_url)} alt="" className="w-8 h-8 rounded-lg object-contain border border-slate-100 bg-white" />}
              <span className="text-xs font-bold">Comune di {comuneInfo.nome}</span>
            </div>
          )}
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{title}</div>
          <div className="text-sm font-bold mt-0.5 truncate">{user?.nome}</div>
          {livelloLabel && (
            <span data-testid="livello-badge" className="inline-block mt-1.5 text-[10px] font-bold rounded-full bg-[#D8EADB] text-[#1F5B33] px-2.5 py-0.5">
              {livelloLabel}
            </span>
          )}
        </div>
        <div className="px-6 pt-4 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Menu</div>
        <nav className="flex-1 px-3 pb-3 space-y-1">
          {visibleLinks.map(([to, label, testid]) => {
            const active = location.pathname === to;
            const Icon = ICONS[testid] || LayoutGrid;
            return (
              <Link key={to} to={to} data-testid={testid}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors
                  ${active ? "bg-[#2F5B41] text-white" : "text-slate-600 hover:bg-[#EEF2EC] hover:text-slate-900"}`}>
                <Icon size={17} /> {label}
              </Link>
            );
          })}
        </nav>
        <button data-testid="backoffice-logout" onClick={() => { logout(); navigate("/"); }}
          className="flex items-center gap-3 mx-3 mb-3 px-3 py-2.5 text-left text-sm font-semibold text-slate-500 rounded-xl hover:bg-[#EEF2EC] hover:text-slate-900 transition-colors">
          <LogOut size={17} /> Esci
        </button>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="h-16 bg-white rounded-2xl border border-slate-100 flex items-center justify-end px-5 sticky top-4 z-[1100]">
          <NotificationBell />
        </div>
        <div className="py-6 px-1">{children}</div>
      </main>
    </div>
  );
};

export const COMUNE_LINKS = [
  ["/comune", "Scrivania pratiche", "link-scrivania"],
  ["/comune/spazi", "Catalogo spazi", "link-spazi", 3],
  ["/comune/form", "Modulo dinamico", "link-form", 3],
  ["/comune/report", "Report & incassi", "link-report"],
  ["/comune/monitor", "Monitor anomalie", "link-monitor", 3],
  ["/comune/profilo", "Profilo & tariffe", "link-profilo", 3],
];

export const ADMIN_LINKS = [
  ["/admin", "Dashboard KPI", "link-kpi"],
  ["/admin/comuni", "Comuni", "link-comuni"],
  ["/admin/monitor", "Monitor anomalie", "link-monitor"],
];
