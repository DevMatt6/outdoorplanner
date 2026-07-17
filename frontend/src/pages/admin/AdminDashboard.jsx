import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BackofficeLayout, ADMIN_LINKS } from "../../components/BackofficeLayout";
import { STATO_COLORS } from "../../components/StatusBadge";
import { api } from "../../lib/api";

export default function AdminDashboard() {
  const [kpi, setKpi] = useState(null);

  useEffect(() => {
    api.get("/admin/kpi").then(({ data }) => setKpi(data));
  }, []);

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
    </BackofficeLayout>
  );
}
