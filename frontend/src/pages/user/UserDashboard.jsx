import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../../components/NavBar";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { Plus, ArrowRight } from "lucide-react";

export default function UserDashboard() {
  const [pratiche, setPratiche] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    api.get("/pratiche").then(({ data }) => setPratiche(data)).finally(() => setLoading(false));
  }, []);

  const attive = pratiche.filter((p) => !["APPROVATA", "RIFIUTATA"].includes(p.stato)).length;
  const daIntegrare = pratiche.filter((p) => p.stato === "INTEGRAZIONE_RICHIESTA").length;

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-6xl mx-auto px-6 py-10" data-testid="user-dashboard">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Area inserzionista</div>
            <h1 className="text-3xl sm:text-4xl font-heading font-extrabold tracking-tight mt-1">Ciao, {user?.nome?.split(" ")[0]}</h1>
          </div>
          <Link to="/spazi" data-testid="nuova-pratica-button"
            className="inline-flex items-center gap-2 bg-[#0033FF] text-white px-6 py-3 font-bold hover:bg-[#0A3D91] transition-colors">
            <Plus size={18} /> Nuova pratica
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-3 border border-slate-900 divide-x divide-slate-900 bg-white">
          <div className="p-5"><div className="font-heading font-extrabold text-3xl">{pratiche.length}</div><div className="text-xs uppercase tracking-wider text-slate-500">Pratiche totali</div></div>
          <div className="p-5"><div className="font-heading font-extrabold text-3xl text-[#F59E0B]">{attive}</div><div className="text-xs uppercase tracking-wider text-slate-500">In corso</div></div>
          <div className="p-5"><div className="font-heading font-extrabold text-3xl text-[#EF4444]">{daIntegrare}</div><div className="text-xs uppercase tracking-wider text-slate-500">Da integrare</div></div>
        </div>

        <div className="mt-8 border border-slate-900 bg-white">
          <div className="px-6 py-3 border-b border-slate-900 text-xs font-bold uppercase tracking-widest bg-slate-50">Le mie pratiche</div>
          {loading && <div className="p-8 text-slate-500">Caricamento...</div>}
          {!loading && pratiche.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-slate-500">Non hai ancora pratiche. Trova uno spazio e avvia la prima candidatura.</p>
              <Link to="/spazi" className="inline-block mt-4 border-2 border-slate-900 px-6 py-2.5 font-bold hover:bg-slate-900 hover:text-white transition-colors">Cerca spazi</Link>
            </div>
          )}
          {pratiche.map((p) => (
            <Link key={p.id} to={`/pratiche/${p.id}`} data-testid={`pratica-row-${p.id}`}
              className="flex flex-wrap items-center gap-4 px-6 py-4 border-b border-slate-200 hover:bg-blue-50 transition-colors">
              <div className="flex-1 min-w-[200px]">
                <div className="font-bold">{p.spazio_nome}</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">{p.data_inizio} → {p.data_fine} · {p.importo.toFixed(2)} €</div>
              </div>
              <StatusBadge stato={p.stato} />
              <ArrowRight size={16} className="text-slate-400" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
