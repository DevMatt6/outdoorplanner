import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BackofficeLayout, ADMIN_LINKS } from "../../components/BackofficeLayout";
import { STATO_COLORS, StatusBadge } from "../../components/StatusBadge";
import { api, imgSrc } from "../../lib/api";
import { Landmark, X } from "lucide-react";

export default function AdminDashboard() {
  const [kpi, setKpi] = useState(null);
  const [comuni, setComuni] = useState([]);
  const [dettaglio, setDettaglio] = useState(null);

  useEffect(() => {
    api.get("/admin/kpi").then(({ data }) => setKpi(data));
    api.get("/admin/comuni").then(({ data }) => setComuni(data));
  }, []);

  const openDettaglio = async (id) => {
    const { data } = await api.get(`/admin/comuni/${id}/report`);
    setDettaglio(data);
  };

  if (!kpi) return <BackofficeLayout title="Superadmin" links={ADMIN_LINKS}><div className="text-slate-500">Caricamento...</div></BackofficeLayout>;

  const statoData = Object.entries(kpi.per_stato).map(([stato, count]) => ({ stato: STATO_COLORS[stato]?.label || stato, count }));

  return (
    <BackofficeLayout title="Superadmin" links={ADMIN_LINKS}>
      <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight" data-testid="admin-kpi-title">Dashboard KPI di piattaforma</h1>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-5 border border-slate-100 rounded-2xl overflow-hidden divide-x divide-y md:divide-y-0 divide-slate-100 bg-white">
        {[
          [kpi.comuni, "Comuni attivi"],
          [kpi.utenti, "Inserzionisti"],
          [kpi.spazi, "Spazi a catalogo"],
          [kpi.pratiche_totali, "Pratiche"],
          [`${kpi.revenue_totale.toFixed(0)} €`, "Revenue aggregata"],
        ].map(([v, l]) => (
          <div key={l} className="p-5">
            <div className="font-heading font-extrabold text-2xl md:text-3xl">{v}</div>
            <div className="text-xs uppercase tracking-wider text-slate-500 mt-1">{l}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <div className="border border-slate-100 bg-white rounded-2xl overflow-hidden p-6">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Pratiche per stato (sistema)</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={statoData}>
              <CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="stato" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 0, border: "1px solid #0F172A" }} />
              <Bar dataKey="count" name="Pratiche" fill="#2F5B41" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="border border-slate-100 bg-white rounded-2xl overflow-hidden p-6">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Volumi per comune</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={kpi.pratiche_per_comune} layout="vertical">
              <CartesianGrid stroke="#E2E8F0" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="comune" tick={{ fontSize: 12 }} width={80} />
              <Tooltip contentStyle={{ borderRadius: 0, border: "1px solid #0F172A" }} />
              <Bar dataKey="count" name="Pratiche" fill="#1F3D2B" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 border border-slate-100 bg-white rounded-2xl overflow-hidden overflow-x-auto" data-testid="kpi-per-comune">
        <div className="px-5 py-3 border-b border-slate-100 text-xs font-bold uppercase tracking-widest bg-[#FAFAF8]">KPI per comune — clicca per il dettaglio</div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              {["Comune", "Spazi attivi", "Pratiche", "Approvate", "Incasso", "Fee piattaforma"].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comuni.map((c) => (
              <tr key={c.id} data-testid={`kpi-comune-row-${c.id}`} onClick={() => openDettaglio(c.id)}
                className="border-b border-slate-100 hover:bg-[#F1F5F0] transition-colors cursor-pointer">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {c.logo_url ? (
                      <img src={imgSrc(c.logo_url)} alt="" className="w-8 h-8 rounded-lg object-contain border border-slate-100 bg-white" />
                    ) : (
                      <span className="w-8 h-8 rounded-lg bg-[#EEF2EC] flex items-center justify-center text-[#2F5B41]"><Landmark size={14} /></span>
                    )}
                    <span className="font-bold">{c.nome}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono">{c.spazi_attivi}/{c.spazi_count}</td>
                <td className="px-4 py-3 font-mono">{c.pratiche_count}</td>
                <td className="px-4 py-3 font-mono">{c.approvate}</td>
                <td className="px-4 py-3 font-heading font-extrabold">{c.incasso_totale.toFixed(2)} €</td>
                <td className="px-4 py-3 font-mono text-slate-500">{c.incasso_piattaforma.toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dettaglio && (
        <div className="mt-6 border border-slate-100 bg-white rounded-2xl overflow-hidden" data-testid="dettaglio-comune">
          <div className="px-5 py-3 border-b border-slate-100 bg-[#FAFAF8] flex items-center justify-between">
            <div className="flex items-center gap-3">
              {dettaglio.comune.logo_url && <img src={imgSrc(dettaglio.comune.logo_url)} alt="" className="w-8 h-8 rounded-lg object-contain border border-slate-100 bg-white" />}
              <span className="font-heading font-extrabold">Comune di {dettaglio.comune.nome}</span>
            </div>
            <button data-testid="chiudi-dettaglio" onClick={() => setDettaglio(null)} className="text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
            {[
              [dettaglio.pratiche_totali, "Pratiche"],
              [dettaglio.per_stato.APPROVATA || 0, "Approvate"],
              [`${dettaglio.incasso_totale.toFixed(2)} €`, "Incasso"],
              [`${dettaglio.incasso_piattaforma.toFixed(2)} €`, "Fee piattaforma"],
            ].map(([v, l]) => (
              <div key={l} className="p-4">
                <div className="font-heading font-extrabold text-xl">{v}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{l}</div>
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-6 p-5">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Incassi per mese (€)</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dettaglio.incassi_mese}>
                  <CartesianGrid stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="mese" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 0, border: "1px solid #0F172A" }} />
                  <Bar dataKey="importo" name="Incassi" fill="#2F5B41" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Ultime pratiche</div>
              <div className="space-y-1.5">
                {dettaglio.ultime_pratiche.map((p, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-xs bg-[#FAFAF8] border border-slate-100 rounded-xl px-3 py-2">
                    <span className="font-mono text-slate-500">{p.data}</span>
                    <span className="font-bold flex-1 min-w-[120px]">{p.spazio_nome}</span>
                    <span className="text-slate-500">{p.user_nome}</span>
                    <StatusBadge stato={p.stato} />
                    <span className="font-bold">{p.importo.toFixed(2)} €</span>
                  </div>
                ))}
                {dettaglio.ultime_pratiche.length === 0 && <div className="text-xs text-slate-500">Nessuna pratica.</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </BackofficeLayout>
  );
}
