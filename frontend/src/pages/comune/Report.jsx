import { useEffect, useState, Fragment } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { STATO_COLORS, StatusBadge } from "../../components/StatusBadge";
import { api } from "../../lib/api";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function Report() {
  const [report, setReport] = useState(null);
  const [perSpazio, setPerSpazio] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get("/comune/report").then(({ data }) => setReport(data));
    api.get("/comune/report/spazi").then(({ data }) => setPerSpazio(data));
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

      <div className="mt-6 border border-slate-100 bg-white rounded-2xl overflow-hidden" data-testid="report-per-spazio">
        <div className="px-5 py-3 border-b border-slate-100 text-xs font-bold uppercase tracking-widest bg-[#FAFAF8]">Dettaglio per spazio</div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              {["Spazio", "Pratiche", "Pagate", "Incassato", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perSpazio.map((s) => (
              <Fragment key={s.spazio_id}>
                <tr className="border-b border-slate-100 hover:bg-[#F1F5F0] transition-colors cursor-pointer"
                  data-testid={`report-spazio-${s.spazio_id}`}
                  onClick={() => setExpanded(expanded === s.spazio_id ? null : s.spazio_id)}>
                  <td className="px-4 py-3">
                    <div className="font-bold">{s.nome}</div>
                    <div className="text-xs text-slate-400">{s.tipologia}{s.formato ? ` · ${s.formato}` : ""}</div>
                  </td>
                  <td className="px-4 py-3 font-mono">{s.pratiche_totali}</td>
                  <td className="px-4 py-3 font-mono">{s.pratiche_pagate}</td>
                  <td className="px-4 py-3 font-heading font-extrabold">{s.incassato.toFixed(2)} €</td>
                  <td className="px-4 py-3 text-slate-400">{expanded === s.spazio_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                </tr>
                {expanded === s.spazio_id && (
                  <tr>
                    <td colSpan={5} className="bg-[#FAFAF8] px-4 py-3 border-b border-slate-100">
                      {s.storico.length === 0 && <div className="text-xs text-slate-500">Nessuna pratica su questo spazio.</div>}
                      <div className="space-y-1.5">
                        {s.storico.map((r, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-3 text-xs bg-white border border-slate-100 rounded-xl px-3 py-2">
                            <span className="font-mono text-slate-500">{r.data}</span>
                            <span className="font-bold flex-1 min-w-[140px]">{r.user_nome}</span>
                            <span className="font-mono text-slate-500">{r.periodo}</span>
                            <StatusBadge stato={r.stato} />
                            <span className="font-bold">{r.importo.toFixed(2)} €</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {perSpazio.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Nessuno spazio a catalogo.</td></tr>}
          </tbody>
        </table>
      </div>
    </BackofficeLayout>
  );
}
