import { PraticheTable } from "../../components/PraticheTable";
import { useConfirm } from "../../components/ConfirmDialog";
import { LoadingState } from "../../components/LoadingState";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserShell } from "../../components/BackofficeLayout";
import { STATO_COLORS } from "../../components/StatusBadge";
import { api, apiError } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { toast } from "sonner";
import { Plus, Megaphone } from "lucide-react";

export default function UserDashboard() {
  const confirm = useConfirm();
  const [pratiche, setPratiche] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    api.get("/pratiche").then(({ data }) => setPratiche(data)).finally(() => setLoading(false));
  }, []);

  const attive = pratiche.filter((p) => !["APPROVATA", "RIFIUTATA"].includes(p.stato)).length;
  const daIntegrare = pratiche.filter((p) => p.stato === "INTEGRAZIONE_RICHIESTA").length;
  const visibili = filtro ? pratiche.filter((p) => p.stato === filtro) : pratiche;

  const removeBozza = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!(await confirm("Eliminare definitivamente questa bozza?"))) return;
    try {
      await api.delete(`/pratiche/${id}`);
      setPratiche((ps) => ps.filter((p) => p.id !== id));
      toast.success("Bozza eliminata");
    } catch (err) { toast.error(apiError(err)); }
  };

  return (
    <UserShell>
      <div className="max-w-6xl mx-auto" data-testid="user-dashboard">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-normal text-slate-500">Area inserzionista</div>
            <h1 className="text-3xl sm:text-3xl font-heading font-semibold tracking-tight mt-1">Le mie pratiche</h1>
            <p className="mt-2 text-sm text-muted-foreground">Ciao, {user?.nome?.split(" ")[0]}. Segui le tue richieste e i relativi Comuni.</p>
          </div>
          <div className="flex gap-3">
            <Link to="/campagne" data-testid="campagne-link"
              className="inline-flex items-center gap-2 border border-slate-200 rounded-md px-6 py-3 font-semibold bg-card hover:border-primary hover:text-brand-foreground transition-colors">
              <Megaphone size={18} /> Campagne
            </Link>
            <Link to="/spazi" data-testid="nuova-pratica-button"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-6 py-3 font-semibold hover:bg-primary transition-colors">
              <Plus size={18} /> Nuova pratica
            </Link>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 border border-slate-100 rounded-xl overflow-hidden divide-x divide-slate-100 bg-card">
          <div className="p-5 hover:bg-accent transition-colors"><div className="font-heading font-semibold text-3xl">{pratiche.length}</div><div className="text-xs tracking-normal text-slate-500">Pratiche totali</div></div>
          <div className="p-5 hover:bg-accent transition-colors"><div className="font-heading font-semibold text-3xl text-warning">{attive}</div><div className="text-xs tracking-normal text-slate-500">In corso</div></div>
          <div className="p-5 hover:bg-accent transition-colors"><div className="font-heading font-semibold text-3xl text-destructive">{daIntegrare}</div><div className="text-xs tracking-normal text-slate-500">Da integrare</div></div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2" data-testid="filtri-stato">
          <button data-testid="filtro-tutte" onClick={() => setFiltro("")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md border transition-colors ${!filtro ? "bg-primary text-primary-foreground border-primary" : "bg-card border-slate-200 text-slate-600 hover:border-primary"}`}>
            Tutte ({pratiche.length})
          </button>
          {Object.entries(STATO_COLORS).map(([stato, cfg]) => {
            const n = pratiche.filter((p) => p.stato === stato).length;
            if (n === 0) return null;
            return (
              <button key={stato} data-testid={`filtro-${stato}`} onClick={() => setFiltro(filtro === stato ? "" : stato)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md border transition-colors ${filtro === stato ? "bg-primary text-primary-foreground border-primary" : "bg-card border-slate-200 text-slate-600 hover:border-primary"}`}>
                {cfg.label} ({n})
              </button>
            );
          })}
        </div>

        <div className="mt-4 border border-slate-100 bg-card rounded-xl overflow-hidden">
          <div className="px-6 py-3 border-b border-slate-100 text-xs font-semibold tracking-normal bg-muted">Le mie pratiche</div>
          {loading && <LoadingState />}
          {!loading && pratiche.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-slate-500">Non hai ancora pratiche. Trova uno spazio e avvia la prima candidatura.</p>
              <Link to="/spazi" className="inline-block mt-4 border border-slate-200 rounded-md px-6 py-2.5 font-semibold hover:bg-primary hover:text-white transition-colors">Cerca spazi</Link>
            </div>
          )}
          {!loading && pratiche.length > 0 && <PraticheTable pratiche={visibili} onDelete={removeBozza} />}

        </div>
      </div>
    </UserShell>
  );
}
