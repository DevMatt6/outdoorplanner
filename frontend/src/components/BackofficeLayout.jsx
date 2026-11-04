import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth, homeFor } from "../store/auth";
import { api, imgSrc } from "../lib/api";
import { NotificationBell } from "./NotificationBell";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./ui/sheet";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from "./ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "./ui/command";
import { LayoutGrid, Inbox, Map, FileSliders, ChartColumn, LogOut, Landmark, Radar, House, Megaphone, PlusCircle, Package, Presentation, Menu, PanelLeftClose, PanelLeftOpen, ChevronDown, ChevronRight, ChevronsUpDown, Search, Sun, Moon } from "lucide-react";

const ICONS = {
  "link-scrivania": Inbox, "link-spazi": Map, "link-form": FileSliders, "link-report": ChartColumn,
  "link-kpi": LayoutGrid, "link-comuni": Landmark, "link-monitor": Radar, "link-zone": Map,
  "link-impianti": Presentation, "link-pacchetti": Package, "link-home": House,
  "link-pratiche-user": Inbox, "link-campagne-user": Megaphone, "link-nuova-ooh": PlusCircle, "link-osp-user": Map,
};

export function Brand({ compact = false }) {
  return <span className={`inline-flex max-w-full shrink-0 items-center dark:rounded-md dark:bg-white ${compact ? "dark:p-1" : "dark:px-2 dark:py-1.5"}`}>
    <img src={compact ? "/logo-mark.svg" : "/logo.svg"} alt="Outdoor Planner" className={compact ? "h-auto w-8" : "h-auto w-52 max-w-full"} />
  </span>;
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return <Button variant="ghost" size="icon" aria-label={dark ? "Attiva tema chiaro" : "Attiva tema scuro"} title={dark ? "Tema chiaro" : "Tema scuro"} onClick={() => setTheme(dark ? "light" : "dark")} data-testid="theme-toggle">{dark ? <Sun /> : <Moon />}</Button>;
}

export const BackofficeLayout = ({ title, links, children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const livello = user?.livello || 1;
  const [comuneInfo, setComuneInfo] = useState(null);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("op_sidebar_collapsed") === "true");
  const [groupOpen, setGroupOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    if (user?.ruolo === "comune") api.get("/comune/profilo").then(({ data }) => setComuneInfo(data)).catch(() => {});
  }, [user?.ruolo]);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    const shortcut = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen((v) => !v); } };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  const visibleLinks = links.filter((l) => !l[3] || livello >= l[3]);
  const current = [...visibleLinks].sort((a, b) => b[0].length - a[0].length).find(([to]) => location.pathname === to || (to !== "/home" && location.pathname.startsWith(to + "/")));
  const pageName = location.pathname === "/dashboard" ? "Le mie pratiche" : current?.[1] || "Dettaglio";
  const roleLabel = user?.ruolo === "comune" ? (livello === 3 ? "Responsabile · L3" : livello === 2 ? "Referente · L2" : "Operatore · L1") : user?.ruolo === "superadmin" ? "Superadmin" : "Inserzionista";
  const initials = user?.nome?.split(" ").map((n) => n[0]).slice(0, 2).join("") || "OP";
  const exit = () => { logout(); navigate("/"); };
  const toggleCollapse = () => setCollapsed((v) => { localStorage.setItem("op_sidebar_collapsed", String(!v)); return !v; });
  const profile = (compact = false) => <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button className={`flex items-center gap-2.5 rounded-lg p-2 text-left hover:bg-accent ${compact ? "" : "w-full"}`} aria-label="Apri menu profilo" data-testid={compact ? "header-profile" : "sidebar-profile"}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-muted text-xs font-medium">{initials}</span>
        {!compact && <><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{user?.nome}</span><span className="block truncate text-xs text-muted-foreground" data-testid="livello-badge">{roleLabel}</span></span><ChevronsUpDown size={14} className="text-muted-foreground" /></>}
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="z-[1600] w-60">
      <DropdownMenuLabel><span className="block">{user?.nome}</span><span className="block truncate text-xs font-normal text-muted-foreground">{user?.email}</span></DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => navigate(homeFor(user))}><House />La mia area</DropdownMenuItem>
      <DropdownMenuItem onSelect={exit} data-testid="backoffice-logout"><LogOut />Esci dall’account</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
  const sidebar = (small = false) => {
    const mini = collapsed && !small;
    return <>
      <Link to={homeFor(user)} aria-label="Outdoor Planner, pagina iniziale" className="flex h-16 shrink-0 items-center border-b px-4"><Brand compact={mini} /></Link>
      {!mini && <div className="mx-3 mt-5 flex items-center gap-2.5 rounded-lg border bg-background p-3" data-testid="comune-logo-sidebar">
        {comuneInfo?.logo_url ? <img src={imgSrc(comuneInfo.logo_url)} alt="" className="h-8 w-8 object-contain" /> : <Landmark size={18} className="shrink-0 text-muted-foreground" />}
        <div className="min-w-0"><div className="truncate text-sm font-medium">{comuneInfo ? `Comune di ${comuneInfo.nome}` : title}</div><div className="text-xs text-muted-foreground">{roleLabel}</div></div>
      </div>}
      <div className="flex-1 overflow-y-auto px-3 py-5">
        {!mini && <button onClick={() => setGroupOpen((v) => !v)} aria-expanded={groupOpen} className="mb-2 flex w-full items-center justify-between px-2 text-xs font-medium text-muted-foreground">Workspace<ChevronDown size={13} className={groupOpen ? "" : "-rotate-90"} /></button>}
        {(groupOpen || mini) && <nav aria-label="Navigazione principale" className="space-y-1">{visibleLinks.map(([to, label, testid]) => {
          const active = current?.[0] === to;
          const Icon = ICONS[testid] || LayoutGrid;
          return <Link key={to} to={to} data-testid={testid} title={mini ? label : undefined} aria-label={mini ? label : undefined} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)} className={`flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"} ${mini ? "justify-center px-0" : ""}`}><Icon size={17} strokeWidth={1.7} />{!mini && <span>{label}</span>}</Link>;
        })}</nav>}
      </div>
      <div className="shrink-0 border-t p-2">{profile(mini)}</div>
    </>;
  };
  return <div className="min-h-screen bg-background lg:flex">
    <a href="#main-content" className="skip-link">Vai al contenuto</a>
    <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-card transition-[width] duration-200 lg:flex ${collapsed ? "w-[72px]" : "w-64"}`}>{sidebar()}</aside>
    <Sheet open={open} onOpenChange={setOpen}><SheetContent side="left" className="flex w-72 flex-col gap-0 bg-card p-0" aria-describedby="mobile-menu-description"><SheetTitle className="sr-only">Menu Outdoor Planner</SheetTitle><SheetDescription id="mobile-menu-description" className="sr-only">Navigazione dell’area {roleLabel}</SheetDescription>{sidebar(true)}</SheetContent></Sheet>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-[1100] flex h-16 items-center justify-between gap-3 border-b bg-card px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" data-testid="sidebar-toggle" aria-label="Apri navigazione" onClick={() => setOpen(true)}><Menu /></Button>
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" aria-label={collapsed ? "Espandi navigazione" : "Riduci navigazione"} onClick={toggleCollapse} data-testid="sidebar-collapse">{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <nav aria-label="Percorso" className="flex min-w-0 items-center gap-2 text-sm"><span className="hidden shrink-0 text-muted-foreground md:block">{title}</span><ChevronRight size={14} className="hidden shrink-0 text-muted-foreground md:block" /><span className="truncate font-medium" aria-current="page">{pageName}</span></nav>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button variant="outline" onClick={() => setSearchOpen(true)} className="hidden w-52 justify-start text-muted-foreground xl:inline-flex"><Search />Cerca nel menu…<kbd className="ml-auto text-[10px]">⌘ K</kbd></Button>
          <Button variant="ghost" size="icon" className="xl:hidden" aria-label="Cerca nel menu" onClick={() => setSearchOpen(true)}><Search /></Button>
          <ThemeToggle /><NotificationBell />{profile(true)}
        </div>
      </header>
      <main id="main-content" className="workspace-content" tabIndex={-1}>{children}</main>
    </div>
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}><DialogContent className="overflow-hidden p-0"><DialogTitle className="sr-only">Cerca nel menu</DialogTitle><DialogDescription className="sr-only">Trova una sezione della tua area di lavoro.</DialogDescription><Command><CommandInput placeholder="Dove vuoi andare?" /><CommandList><CommandEmpty>Nessuna sezione trovata.</CommandEmpty><CommandGroup heading="Navigazione">{visibleLinks.map(([to, label, testid]) => { const Icon = ICONS[testid] || LayoutGrid; return <CommandItem key={to} onSelect={() => { navigate(to); setSearchOpen(false); }}><Icon />{label}</CommandItem>; })}</CommandGroup></CommandList></Command></DialogContent></Dialog>
  </div>;
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
  ["/campagne", "Le mie campagne", "link-campagne-user"],
  ["/dashboard", "Le mie pratiche", "link-pratiche-user"],
  ["/campagne/ooh/nuova", "Nuova campagna OOH", "link-nuova-ooh"],
  ["/spazi", "OSP / Eventi", "link-osp-user"],
];

export const UserShell = ({ children }) => (
  <BackofficeLayout title="Area Inserzionista" links={USER_LINKS}>{children}</BackofficeLayout>
);
