import { Link } from "react-router-dom";
import { UserShell } from "../../components/BackofficeLayout";
import { useAuth } from "../../store/auth";
import { Megaphone, Tent, ArrowRight, FolderOpen, LayoutDashboard } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  return (
    <UserShell>
      <div className="max-w-6xl mx-auto" data-testid="home-hub">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Ciao, {user?.nome?.split(" ")[0]}</div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-extrabold tracking-tight mt-1">Cosa vuoi fare?</h1>
        <p className="text-slate-500 mt-2 max-w-2xl">Scegli il servizio: la campagna pubblicitaria sui circuiti OOH dei Comuni oppure la richiesta di spazi per eventi e occupazioni temporanee.</p>

        <div className="mt-10 grid md:grid-cols-2 gap-6">
          <Link to="/campagne/ooh/nuova" data-testid="hub-card-ooh"
            className="group bg-[#2B4BDB] text-white rounded-3xl p-10 flex flex-col justify-between min-h-[300px] hover:bg-[#172E93] transition-colors">
            <div>
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10"><Megaphone size={26} /></span>
              <h2 className="font-heading font-extrabold text-2xl mt-6">Pianifica una Campagna OOH</h2>
              <p className="text-emerald-100/80 text-sm mt-3 leading-relaxed">Seleziona un territorio e prenota i circuiti pubblicitari messi a disposizione dai Comuni: zone, vie e pacchetti di impianti con blocco 24 ore.</p>
            </div>
            <span className="inline-flex items-center gap-2 font-bold mt-8 bg-white text-[#2B4BDB] rounded-full px-6 py-3 w-fit group-hover:gap-3 transition-all">
              Pianifica Campagna <ArrowRight size={17} />
            </span>
          </Link>

          <Link to="/spazi" data-testid="hub-card-osp"
            className="group bg-white border border-slate-100 rounded-3xl p-10 flex flex-col justify-between min-h-[300px] hover:border-[#1F3BB3] transition-colors">
            <div>
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#E8EFFF] text-[#1F3BB3]"><Tent size={26} /></span>
              <h2 className="font-heading font-extrabold text-2xl mt-6">OSP / Progetti Speciali – Eventi</h2>
              <p className="text-slate-500 text-sm mt-3 leading-relaxed">Richiedi uno spazio per eventi, occupazioni di suolo pubblico, installazioni temporanee e progetti speciali con l'iter amministrativo online.</p>
            </div>
            <span className="inline-flex items-center gap-2 font-bold mt-8 bg-[#1F3BB3] text-white rounded-full px-6 py-3 w-fit group-hover:gap-3 transition-all">
              Avvia richiesta OSP <ArrowRight size={17} />
            </span>
          </Link>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 gap-4">
          <Link to="/dashboard" data-testid="hub-link-pratiche"
            className="bg-white border border-slate-100 rounded-2xl px-6 py-5 flex items-center gap-4 hover:border-[#1F3BB3] transition-colors">
            <FolderOpen size={20} className="text-[#1F3BB3]" />
            <div>
              <div className="font-heading font-extrabold">Le mie pratiche</div>
              <div className="text-xs text-slate-500">Campagne OOH e richieste OSP, identificate per tipologia</div>
            </div>
          </Link>
          <Link to="/campagne" data-testid="hub-link-campagne"
            className="bg-white border border-slate-100 rounded-2xl px-6 py-5 flex items-center gap-4 hover:border-[#1F3BB3] transition-colors">
            <LayoutDashboard size={20} className="text-[#1F3BB3]" />
            <div>
              <div className="font-heading font-extrabold">Le mie campagne</div>
              <div className="text-xs text-slate-500">Prenotazioni, countdown 24h e stato di avanzamento</div>
            </div>
          </Link>
        </div>
      </div>
    </UserShell>
  );
}
