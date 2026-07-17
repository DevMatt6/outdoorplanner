import { useEffect, useState } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { STATO_COLORS } from "../../components/StatusBadge";
import { api } from "../../lib/api";

export default function Report() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    api.get("/comune/report").then(({ data }) => setReport(data));
  }, []);

  if (!report) return <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}><div className="text-slate-500">Caricamento...</div></BackofficeLayout>;

  const statoData = Object.entries(report.per_stato).map(([stato, count]) => ({ stato: STATO_COLORS[stato]?.label || stato, count, fill: STATO_COLORS[stato]?.dot }));

  return (
    <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}>
      <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight" data-testid="report-title">Report & incassi</h1>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 border border-slate-100 rounded-2xl overflow-hidden divide-x divide-slate-100 bg-white">
        {[
          [`${report.incassi_totali.toFixed(2)} €`, "Incassi totali"],
          [report.pratiche_totali, "Pratiche ricevute"],
          [report.approvate, "Approvate"],
          [report.spazi_totali, "Spazi a catalogo"],
        ].map(([v, l]) => (
          <div key={l} className="p-5">
            <div className="font-heading font-extrabold text-2xl md:text-3xl">{v}</div>
            <div className="text-xs uppercase tracking-wider text-slate-500 mt-1">{l}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <div className="border border-slate-100 bg-white rounded-2xl overflow-hidden p-6">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Pratiche per stato</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={statoData}>
              <CartesianGrid strokeDasharray="0" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="stato" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 0, border: "1px solid #0F172A" }} />
              <Bar dataKey="count" name="Pratiche" isAnimationActive={false}>
                {statoData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="border border-slate-100 bg-white rounded-2xl overflow-hidden p-6">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Incassi per mese (€)</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={report.incassi_mese}>
              <CartesianGrid strokeDasharray="0" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="mese" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 0, border: "1px solid #0F172A" }} />
              <Bar dataKey="importo" name="Incassi" fill="#1F3D2B" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </BackofficeLayout>
  );
}
