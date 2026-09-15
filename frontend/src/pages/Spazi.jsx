import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { useAuth } from "../store/auth";
import { UserShell } from "../components/BackofficeLayout";
import { EsploraMappa } from "../components/EsploraMappa";
import { SpazioCard } from "../components/SpazioCard";
import { api, imgSrc } from "../lib/api";
import { TIPOLOGIE, FORMATI } from "../lib/catalogo";
import { Megaphone, Landmark, ArrowLeft } from "lucide-react";

const PublicShell = ({ children }) => (<div className="min-h-screen"><NavBar />{children}</div>);

export default function Spazi() {
  const [params, setParams] = useSearchParams();
  const [all, setAll] = useState([]);
  const [comuni, setComuni] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const Shell = user?.ruolo === "user" ? UserShell : PublicShell;
  const filters = {
    regione: params.get("regione") || "",
    citta: params.get("citta") || "",
    zona: params.get("zona") || "",
    tipologia: params.get("tipologia") || "",
    formato: params.get("formato") || "",
    q: params.get("q") || "",
  };

  useEffect(() => {
    api.get("/comuni").then(({ data }) => setComuni(data));
  }, []);

  useEffect(() => {
    setLoading(true);
    const query = {};
    ["regione", "tipologia", "formato", "q"].forEach((k) => { if (filters[k]) query[k] = filters[k]; });
    api.get("/spazi", { params: query }).then(({ data }) => setAll(data)).finally(() => setLoading(false));
  }, [params]);

  const setMany = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => { if (v) next.set(k, v); else next.delete(k); });
    setParams(next);
  };

  const onRegione = (r) => setMany({ regione: r || "", citta: "", zona: "" });
  const onComune = (nome) => {
    if (!nome) return setMany({ citta: "", zona: "", regione: "" });
    const c = comuni.find((x) => x.nome === nome);
    setMany({ citta: nome, zona: "", regione: c?.regione || filters.regione });
  };
  const onZona = (z) => setMany({ zona: z || "" });

  const spaziComune = useMemo(() => (filters.citta ? all.filter((s) => s.citta === filters.citta) : all), [all, filters.citta]);
  const gridSpazi = filters.zona ? spaziComune.filter((s) => (s.zona || "Altro") === filters.zona) : spaziComune;

  const countPerComune = useMemo(() => {
    const m = {};
    all.forEach((s) => { m[s.citta] = (m[s.citta] || 0) + 1; });
    return m;
  }, [all]);

  const comuniGrid = (filters.regione ? comuni.filter((c) => c.regione === filters.regione) : comuni)
    .slice()
    .sort((a, b) => (countPerComune[b.nome] || 0) - (countPerComune[a.nome] || 0));

  const input = "border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1F3BB3] bg-white";

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold tracking-tight">
            Spazi OSP / Eventi {filters.citta ? <span className="text-[#1F3BB3]">· {filters.citta}{filters.zona ? ` / ${filters.zona}` : ""}</span> : filters.regione && <span className="text-[#1F3BB3]">· {filters.regione}</span>}
          </h1>
          <button data-testid="avvia-campagna-button" onClick={() => navigate("/campagne/ooh/nuova")}
            className="inline-flex items-center gap-2 bg-[#1F3BB3] text-white rounded-full px-6 py-3 font-bold hover:bg-[#172E93] transition-colors">
            <Megaphone size={17} /> Pianifica campagna OOH
          </button>
        </div>
        <p className="text-sm text-slate-500 mt-1">Aree comunali per eventi, occupazioni temporanee e progetti speciali: scegli il Comune e avvia la richiesta OSP.</p>

        <div className="mt-6 bg-white border border-slate-100 rounded-2xl p-4 flex flex-wrap gap-3 items-center" data-testid="filtri-spazi">
          <input data-testid="filter-q" className={input} placeholder="Cerca per nome o indirizzo..."
            defaultValue={filters.q} onKeyDown={(e) => e.key === "Enter" && setMany({ q: e.target.value })} />
          <select data-testid="filter-tipologia" className={input} value={filters.tipologia} onChange={(e) => setMany({ tipologia: e.target.value })}>
            <option value="">Tipologia impianto</option>
            {TIPOLOGIE.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select data-testid="filter-formato" className={input} value={filters.formato} onChange={(e) => setMany({ formato: e.target.value })}>
            <option value="">Formato</option>
            {FORMATI.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <span className="ml-auto text-sm text-slate-500 font-mono" data-testid="risultati-count">
            {filters.citta ? `${gridSpazi.length} spazi` : `${all.length} spazi in ${Object.keys(countPerComune).length} Comuni`}
          </span>
        </div>

        <div className="mt-6">
          <EsploraMappa comuni={comuni} spazi={spaziComune}
            regione={filters.regione} comune={filters.citta} zona={filters.zona}
            onRegione={onRegione} onComune={onComune} onZona={onZona}
            onPinClick={(s) => navigate(`/spazi/${s.id}`)} height={480} />
        </div>

        {!filters.citta && (
          <div className="mt-8">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">
              Comuni {filters.regione ? `in ${filters.regione}` : "attivi"}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" data-testid="comuni-grid">
              {comuniGrid.map((c) => (
                <button key={c.id} data-testid={`comune-card-${c.id}`} onClick={() => onComune(c.nome)}
                  className="bg-white border border-slate-100 rounded-2xl p-5 text-left hover:border-[#1F3BB3] transition-colors group">
                  {c.logo_url ? (
                    <img src={imgSrc(c.logo_url)} alt="" className="w-10 h-10 rounded-xl object-contain border border-slate-100 bg-white" />
                  ) : (
                    <span className="w-10 h-10 rounded-xl bg-[#F0F4FF] flex items-center justify-center text-[#1F3BB3]"><Landmark size={18} /></span>
                  )}
                  <div className="font-heading font-extrabold mt-3 group-hover:text-[#2B4BDB] transition-colors">{c.nome}</div>
                  <div className="text-xs text-slate-500">{c.regione}</div>
                  <div className="text-xs font-bold text-[#1F3BB3] mt-2">{countPerComune[c.nome] || 0} spazi</div>
                </button>
              ))}
              {comuniGrid.length === 0 && <div className="col-span-full text-sm text-slate-500 bg-white border border-slate-100 rounded-2xl p-8 text-center">Nessun Comune attivo in questa regione.</div>}
            </div>
          </div>
        )}

        {filters.citta && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Spazi a {filters.citta}{filters.zona ? ` — ${filters.zona}` : ""}
              </div>
              <button data-testid="torna-comuni-button" onClick={() => onComune(null)}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-[#1F3BB3] transition-colors">
                <ArrowLeft size={15} /> Tutti i Comuni
              </button>
            </div>
            {loading && <div className="text-slate-500 p-8">Caricamento...</div>}
            {!loading && gridSpazi.length === 0 && (
              <div className="border border-slate-100 bg-white rounded-2xl p-10 text-center text-slate-500">Nessuno spazio trovato con questi filtri.</div>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" data-testid="spazi-grid">
              {gridSpazi.map((s) => (
                <SpazioCard key={s.id} spazio={s} onClick={() => navigate(`/spazi/${s.id}`)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
