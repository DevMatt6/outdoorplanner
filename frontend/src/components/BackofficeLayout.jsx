import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { api, imgSrc } from "../lib/api";
import { NotificationBell } from "./NotificationBell";
import { LayoutGrid, Inbox, Map, FileSliders, ChartColumn, LogOut, Landmark, Radar, House, Megaphone, PlusCircle, Package, Presentation } from "lucide-react";

const ICONS = {
  "link-scrivania": Inbox,
  "link-spazi": Map,
  "link-form": FileSliders,
  "link-report": ChartColumn,
  "link-kpi": LayoutGrid,
  "link-comuni": Landmark,
  "link-monitor": Radar,
  "link-zone": Map,
  "link-impianti": Presentation,
  "link-pacchetti": Package,
  "link-home": House,
  "link-pratiche-user": Inbox,
  "link-campagne-user": Megaphone,
  "link-nuova-ooh": PlusCircle,
  "link-osp-user": Map,
};

const SUBTITLES = {
  user: "La tua panoramica di campagne e pratiche",
  comune: "Backoffice pratiche, impianti e territorio",
  superadmin: "Panoramica della piattaforma",
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
  const ora = new Date().getHours();
  const saluto = ora < 13 ? "Buongiorno" : ora < 18 ? "Buon pomeriggio" : "Buonasera";

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex">
      <aside className="w-64 shrink-0 bg-white border-r border-[#E5E9F2] flex flex-col sticky top-0 h-screen">
        <Link to="/" className="flex items-center gap-3 px-6 h-16 border-b border-[#E5E9F2] shrink-0">
          <span className="bg-[#1F3BB3] text-white font-heading font-extrabold w-9 h-9 rounded-xl flex items-center justify-center text-sm shadow-sm">OP</span>
          <span className="font-heading font-extrabold text-base tracking-tight text-[#1F2937]">Outdoor Planner</span>
        </Link>
        <div className="mx-4 my-3 p-3 bg-[#F8F9FD] rounded-xl border border-[#E5E9F2]">
          {comuneInfo && (
            <div className="flex items-center gap-2 mb-2" data-testid="comune-logo-sidebar">
              {comuneInfo.logo_url && <img src={imgSrc(comuneInfo.logo_url)} alt="" className="w-8 h-8 rounded-lg object-contain border border-[#E5E9F2] bg-white" />}
              <span className="text-xs font-bold text-[#1F2937]">Comune di {comuneInfo.nome}</span>
            </div>
          )}
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8D94A5]">{title}</div>
          <div className="text-sm font-bold mt-0.5 truncate text-[#1F2937]">{user?.nome}</div>
          {livelloLabel && (
            <span data-testid="livello-badge" className="inline-block mt-1.5 text-[10px] font-bold rounded-full bg-[#E8EFFF] text-[#1F3BB3] px-2.5 py-0.5">
              {livelloLabel}
            </span>
          )}
        </div>
        <div className="px-6 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#8D94A5]">Menu</div>
        <nav className="flex-1 px-3 pb-3 space-y-1 overflow-y-auto">
          {visibleLinks.map(([to, label, testid]) => {
            const active = location.pathname === to;
            const Icon = ICONS[testid] || LayoutGrid;
            return (
              <Link key={to} to={to} data-testid={testid}
                className={`flex items-center gap-3 px-3.5 py-2.5 text-sm rounded-xl transition-colors
                  ${active ? "bg-[#1F3BB3] text-white font-semibold shadow-sm shadow-[#1F3BB3]/20" : "font-medium text-[#525B6C] hover:bg-[#F0F4FF] hover:text-[#1F3BB3]"}`}>
                <Icon size={17} /> {label}
              </Link>
            );
          })}
        </nav>
        <button data-testid="backoffice-logout" onClick={() => { logout(); navigate("/"); }}
          className="flex items-center gap-3 mx-3 mb-3 px-3.5 py-2.5 text-left text-sm font-medium text-[#525B6C] rounded-xl hover:bg-[#F0F4FF] hover:text-[#1F3BB3] transition-colors shrink-0">
          <LogOut size={17} /> Esci
        </button>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="h-16 bg-white/95 backdrop-blur-md border-b border-[#E5E9F2] flex items-center justify-between px-6 sticky top-0 z-[1100]">
          <div>
            <div className="text-base sm:text-lg font-bold tracking-tight text-[#1F2937]" data-testid="header-greeting">
              {saluto}, <span className="text-[#1F3BB3]">{user?.nome?.split(" ")[0]}</span>
            </div>
            <div className="text-xs text-[#6C7383] hidden sm:block">{SUBTITLES[user?.ruolo] || ""}</div>
          </div>
          <NotificationBell />
        </div>
        <div className="py-6 px-6">{children}</div>
      </main>
    </div>
  );
};

export const COMUNE_LINKS = [
  ["/comune", "Scrivania pratiche", "link-scrivania"],
  ["/comune/zone", "Zone & confini", "link-zone", 3],
  ["/comune/impianti", "Impianti OOH", "link-impianti", 3],
  ["/comune/pacchetti", "Circuiti / Pacchetti", "link-pacchetti", 3],
  ["/comune/spazi", "Aree OSP", "link-spazi", 3],
  ["/comune/form", "Modulo dinamico", "link-form", 3],
  ["/comune/report", "Report & incassi", "link-report"],
  ["/comune/monitor", "Monitor anomalie", "link-monitor", 3],
];

export const ADMIN_LINKS = [
  ["/admin", "Dashboard KPI", "link-kpi"],
  ["/admin/comuni", "Comuni", "link-comuni"],
  ["/admin/monitor", "Monitor anomalie", "link-monitor"],
];

export const USER_LINKS = [
  ["/home", "Panoramica", "link-home"],
  ["/dashboard", "Le mie pratiche", "link-pratiche-user"],
  ["/campagne", "Le mie campagne", "link-campagne-user"],
  ["/campagne/ooh/nuova", "Nuova campagna OOH", "link-nuova-ooh"],
  ["/spazi", "OSP / Eventi", "link-osp-user"],
];

export const UserShell = ({ children }) => (
  <BackofficeLayout title="Area Inserzionista" links={USER_LINKS}>{children}</BackofficeLayout>
);
