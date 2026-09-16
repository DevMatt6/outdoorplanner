import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserShell } from "../../components/BackofficeLayout";
import { STATO_COLORS, TipoBadge } from "../../components/StatusBadge";
import { api } from "../../lib/api";
import { Plus, ArrowRight, Megaphone } from "lucide-react";

export default function Campagne() {
  const [campagne, setCampagne] = useState(null);
  const [singole, setSingole] = useState([]);

  useEffect(() => {
    api.get("/campagne").then(({ data }) => setCampagne(data));
    api.get("/pratiche").then(({ data }) => setSingole(data.filter((p) => !p.campagna_id)));
  }, []);

  return (
    <UserShell>
      <div className="max-w-6xl mx-auto" data-testid="campagne-page">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Campaign Planner</div>
            <h1 className="text-3xl sm:text-4xl font-heading font-extrabold tracking-tight mt-1">Le mie campagne</h1>
          </div>
          <Link to="/campagne/ooh/nuova" data-testid="nuova-campagna-button"
            className="inline-flex items-center gap-2 bg-[#1F3BB3] text-white rounded-full px-6 py-3 font-bold hover:bg-[#172E93] transition-colors">
            <Plus size={18} /> Pianifica campagna OOH
          </Link>
        </div>

        <div className="mt-8 space-y-4">
          {campagne === null && <div className="text-slate-500 p-6">Caricamento...</div>}
          {campagne?.length === 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center">
              <Megaphone size={32} className="mx-auto text-[#1F3BB3]" />
              <p className="text-slate-500 mt-3">Nessuna campagna. Pianifica una campagna OOH: periodo, Comuni, zone e circuiti con blocco 24 ore.</p>
              <Link to="/campagne/ooh/nuova" className="inline-block mt-5 border border-slate-200 rounded-full px-6 py-2.5 font-bold hover:border-[#1F3BB3] hover:text-[#1F3BB3] transition-colors">
                Inizia ora
              </Link>
            </div>
          )}
          {campagne?.map((c) => (
            <Link key={c.id} to={c.tipo === "OOH" ? `/campagne/ooh/${c.id}` : `/campagne/${c.id}`} data-testid={`campagna-card-${c.id}`}
              className="block bg-white border border-slate-100 rounded-2xl p-6 hover:border-[#1F3BB3] transition-colors">
              <div className="flex flex-wrap items-center gap-4 justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-heading font-extrabold text-lg">{c.nome}</div>
                    <TipoBadge tipo={c.tipo} />
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    {c.data_inizio} → {c.data_fine} · {(c.pacchetti_ids || c.spazi_ids || []).length} {c.tipo === "OOH" ? "circuiti" : "spazi"} · {c.importo_totale.toFixed(2)} €
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {Object.entries(c.per_stato).map(([stato, n]) => (
                    <span key={stato} className="text-[11px] font-bold rounded-full px-2.5 py-1"
                      style={{ backgroundColor: STATO_COLORS[stato]?.bg, color: STATO_COLORS[stato]?.text }}>
                      {n} {STATO_COLORS[stato]?.label}
                    </span>
                  ))}
                  <ArrowRight size={16} className="text-slate-400 ml-1" />
                </div>
              </div>
            </Link>
          ))}
          {singole.length > 0 && (
            <div className="mt-8" data-testid="pratiche-singole">
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400 mb-3">Richieste singole OSP</div>
              <div className="space-y-3">
                {singole.map((p) => (
                  <Link key={p.id} to={`/pratiche/${p.id}`} data-testid={`pratica-singola-${p.id}`}
                    className="block bg-white border border-slate-100 rounded-2xl px-6 py-4 hover:border-[#1F3BB3] transition-colors">
                    <div className="flex flex-wrap items-center gap-4 justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-heading font-extrabold">{p.spazio_nome}</div>
                          <TipoBadge tipo={p.tipo} />
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{p.data_inizio} → {p.data_fine} · {p.importo.toFixed(2)} €</div>
                      </div>
                      <span className="text-[11px] font-bold rounded-full px-2.5 py-1"
                        style={{ backgroundColor: STATO_COLORS[p.stato]?.bg, color: STATO_COLORS[p.stato]?.text }}>
                        {STATO_COLORS[p.stato]?.label || p.stato}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </UserShell>
  );
}
