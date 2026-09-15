import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { StatusBadge } from "../../components/StatusBadge";
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

  return (
    <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}>
      <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight" data-testid="scrivania-title">Scrivania pratiche</h1>
      <div className="mt-6 flex flex-wrap border border-slate-100 bg-white rounded-2xl overflow-hidden" data-testid="code-tabs">
        {CODE.map((c) => (
          <button key={c.key} data-testid={`coda-${c.key || "tutte"}`} onClick={() => setStato(c.key)}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-r border-slate-100 last:border-r-0 transition-colors
              ${stato === c.key ? "bg-[#1F3BB3] text-white" : "hover:bg-slate-100"}`}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="mt-4 border border-slate-100 bg-white rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#F8F9FD] border-b border-slate-100 text-left">
              {["Spazio", "Richiedente", "Periodo", "Importo", "Stato", "Aggiornata", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-8 text-slate-500">Caricamento...</td></tr>}
            {!loading && pratiche.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-slate-500">Nessuna pratica in questa coda.</td></tr>}
            {pratiche.map((p) => (
              <tr key={p.id} className="border-b border-slate-200 hover:bg-[#F0F4FF] transition-colors">
                <td className="px-4 py-3 font-bold">{p.spazio_nome}</td>
                <td className="px-4 py-3">{p.user_nome}</td>
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
    </BackofficeLayout>
  );
}
