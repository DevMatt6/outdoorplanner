import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { StatusBadge, TipoBadge } from "../../components/StatusBadge";
import { api } from "../../lib/api";

const CODE = [
  { key: "", label: "Tutte" },
  { key: "INVIATA", label: "Da assegnare · L1" },
  { key: "IN_ISTRUTTORIA", label: "In istruttoria · L2" },
  { key: "INTEGRAZIONE_RICHIESTA", label: "Attesa integrazione" },
  { key: "APPROVATA", label: "Approvate" },
  { key: "RIFIUTATA", label: "Rifiutate" },
];

export default function Scrivania() {
  const [pratiche, setPratiche] = useState([]);
  const [stato, setStato] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/comune/pratiche", { params: stato ? { stato } : {} })
      .then(({ data }) => setPratiche(data)).finally(() => setLoading(false));
  }, [stato]);

  const gruppi = useMemo(() => {
    const map = {};
    pratiche.forEach((p) => {
      const k = p.campagna_id || "__singole__";
      if (!map[k]) map[k] = { nome: p.campagna_id ? (p.campagna_nome || "Campagna") : "Richieste singole OSP", tipo: p.tipo, pratiche: [] };
      map[k].pratiche.push(p);
    });
    return Object.entries(map);
  }, [pratiche]);

  return (
    <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}>
      <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight" data-testid="scrivania-title">Scrivania pratiche</h1>
      <p className="text-sm text-slate-500 mt-1">Le pratiche sono raggruppate per campagna: per ogni campagna vedi solo le pratiche di competenza del tuo Comune.</p>
      <div className="mt-6 flex flex-wrap border border-slate-100 bg-white rounded-2xl overflow-hidden" data-testid="code-tabs">
        {CODE.map((c) => (
          <button key={c.key} data-testid={`coda-${c.key || "tutte"}`} onClick={() => setStato(c.key)}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-r border-slate-100 last:border-r-0 transition-colors
              ${stato === c.key ? "bg-[#1F3BB3] text-white" : "hover:bg-slate-100"}`}>
            {c.label}
          </button>
        ))}
      </div>
      {loading && <div className="mt-4 bg-white border border-slate-100 rounded-2xl px-4 py-8 text-slate-500">Caricamento...</div>}
      {!loading && gruppi.length === 0 && <div className="mt-4 bg-white border border-slate-100 rounded-2xl px-4 py-8 text-slate-500">Nessuna pratica in questa coda.</div>}
      <div className="mt-4 space-y-5">
        {gruppi.map(([gid, g]) => (
          <div key={gid} className="border border-slate-100 bg-white rounded-2xl overflow-hidden" data-testid={`gruppo-campagna-${gid}`}>
            <div className="px-5 py-3 bg-[#F8F9FD] border-b border-slate-100 flex flex-wrap items-center gap-3">
              <span className="font-heading font-extrabold">{g.nome}</span>
              <TipoBadge tipo={g.tipo} />
              <span className="text-xs text-slate-500">{g.pratiche.length} pratiche per il tuo Comune · {g.pratiche[0].data_inizio} → {g.pratiche[0].data_fine} · richiedente {g.pratiche[0].user_nome}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    {["Spazio / Circuito", "Periodo", "Importo", "Stato", "Aggiornata", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.pratiche.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 last:border-b-0 hover:bg-[#F0F4FF] transition-colors">
                      <td className="px-4 py-3 font-bold">{p.spazio_nome}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.data_inizio} → {p.data_fine}</td>
                      <td className="px-4 py-3 font-semibold">{p.importo.toFixed(2)} € {p.pagata && <span className="text-[#10B981]">✓</span>}</td>
                      <td className="px-4 py-3"><StatusBadge stato={p.stato} /></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(p.updated_at).toLocaleDateString("it-IT")}</td>
                      <td className="px-4 py-3">
                        <Link to={`/comune/pratiche/${p.id}`} data-testid={`istruttoria-link-${p.id}`}
                          className="text-xs font-bold text-[#1F3BB3] hover:text-[#2B4BDB] uppercase tracking-wider">
                          Istruttoria →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </BackofficeLayout>
  );
}
