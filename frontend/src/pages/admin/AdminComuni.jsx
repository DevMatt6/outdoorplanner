import { useEffect, useState } from "react";
import { BackofficeLayout, ADMIN_LINKS } from "../../components/BackofficeLayout";
import { api, apiError, imgSrc } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Upload, Landmark, Pencil, Trash2, Users } from "lucide-react";

const EMPTY = { nome: "", regione: "", provincia: "", lat: "", lng: "", logo_url: "", livelli: [1], utenze: [] };
const NUOVA_UTENZA = { nome: "", email: "", password: "", livello: 1 };

const REGIONI = ["Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche", "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia", "Toscana", "Trentino-Alto Adige/Südtirol", "Umbria", "Valle d'Aosta/Vallée d'Aoste", "Veneto"];

export default function AdminComuni() {
  const [comuni, setComuni] = useState([]);
  const [form, setForm] = useState(null);
  const [nuovaUt, setNuovaUt] = useState({ ...NUOVA_UTENZA });
  const [utentiPanel, setUtentiPanel] = useState(null);

  const openUtenti = async (c) => {
    const { data } = await api.get(`/admin/comuni/${c.id}/utenti`);
    setUtentiPanel({ comune: c, utenti: data, nuova: { ...NUOVA_UTENZA } });
  };

  const toggleAttivo = async (u) => {
    try {
      await api.patch(`/admin/utenti/${u.id}`, { attivo: u.attivo === false });
      openUtenti(utentiPanel.comune);
    } catch (err) { toast.error(apiError(err)); }
  };

  const aggiungiUtente = async () => {
    const n = utentiPanel.nuova;
    if (!n.email || !n.password || !n.nome) return toast.error("Compila nome, email e password");
    try {
      await api.post(`/admin/comuni/${utentiPanel.comune.id}/utenti`, n);
      toast.success("Utenza creata");
      openUtenti(utentiPanel.comune);
    } catch (err) { toast.error(apiError(err)); }
  };

  const load = () => api.get("/admin/comuni").then(({ data }) => setComuni(data));
  useEffect(() => { load(); }, []);

  const uploadLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/admin/upload-logo", fd);
      setForm((f) => ({ ...f, logo_url: data.url }));
      toast.success("Logo caricato");
    } catch (err) { toast.error(apiError(err)); }
    e.target.value = "";
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, lat: parseFloat(form.lat), lng: parseFloat(form.lng), logo_url: form.logo_url || null };
      if (form.id) {
        await api.put(`/admin/comuni/${form.id}`, { nome: form.nome, regione: form.regione, provincia: form.provincia, lat: payload.lat, lng: payload.lng, logo_url: payload.logo_url, livelli_attivi: form.livelli });
        toast.success(`Comune ${form.nome} aggiornato`);
      } else {
        if (form.utenze.length === 0) return toast.error("Aggiungi almeno un'utenza comunale");
        await api.post("/admin/comuni", { ...payload, livelli_attivi: form.livelli, utenze: form.utenze });
        toast.success(`Comune ${form.nome} attivato con ${form.utenze.length} utenze`);
      }
      setForm(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const openEdit = (c) => setForm({ id: c.id, nome: c.nome, regione: c.regione, provincia: c.provincia, lat: c.lat, lng: c.lng, logo_url: c.logo_url || "", livelli: c.livelli_attivi || [1, 2, 3], utenze: [] });

  const remove = async (c) => {
    if (!window.confirm(`Eliminare definitivamente il Comune di ${c.nome}?\nVerranno rimossi anche ${c.spazi_count} spazi, ${c.pratiche_count} pratiche e gli account degli operatori. L'operazione non è reversibile.`)) return;
    try {
      await api.delete(`/admin/comuni/${c.id}`);
      toast.success(`Comune ${c.nome} eliminato`);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const input = "border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#2F5B41] transition-colors bg-white w-full";

  return (
    <BackofficeLayout title="Superadmin" links={ADMIN_LINKS}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">Comuni</h1>
        <button data-testid="onboard-comune-button" onClick={() => setForm({ ...EMPTY })}
          className="inline-flex items-center gap-2 bg-[#2F5B41] text-white rounded-full px-5 py-2.5 font-bold hover:bg-[#26492F] transition-colors">
          <Plus size={17} /> Onboarding comune
        </button>
      </div>

      {form && (
        <form onSubmit={submit} className="mt-6 border border-slate-100 bg-white rounded-2xl p-6" data-testid="onboard-form">
          <h2 className="font-heading font-extrabold text-lg mb-4">{form.id ? `Modifica Comune di ${form.nome}` : "Nuovo comune"}</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <input data-testid="onboard-nome" className={input} placeholder="Nome comune" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <select data-testid="onboard-regione" className={input} required value={form.regione} onChange={(e) => setForm({ ...form, regione: e.target.value })}>
              <option value="">— Regione —</option>
              {REGIONI.map((r) => <option key={r}>{r}</option>)}
            </select>
            <input className={input} placeholder="Provincia (sigla)" required value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} />
            <input className={input} type="number" step="any" placeholder="Latitudine" required value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
            <input className={input} type="number" step="any" placeholder="Longitudine" required value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
          </div>
          <div className="mt-4 flex items-center gap-3">
            {form.logo_url ? (
              <img src={imgSrc(form.logo_url)} alt="logo" className="w-14 h-14 rounded-xl object-contain border border-slate-100 bg-white" />
            ) : (
              <span className="w-14 h-14 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-slate-300"><Landmark size={22} /></span>
            )}
            <label className="cursor-pointer inline-flex items-center gap-2 border border-slate-200 rounded-full px-4 py-2 text-sm font-bold hover:border-[#2F5B41] hover:text-[#2F5B41] transition-colors">
              <Upload size={15} /> Carica logo comune
              <input data-testid="onboard-logo-input" type="file" accept=".png,.svg,.jpg,.jpeg,.webp" className="hidden" onChange={uploadLogo} />
            </label>
            <span className="text-xs text-slate-400">PNG, SVG, JPG (facoltativo)</span>
          </div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-5 mb-2">Livelli autorizzativi attivi</div>
          <div className="flex gap-4">
            {[1, 2, 3].map((l) => (
              <label key={l} className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" data-testid={`livello-check-${l}`} className="w-4 h-4 accent-[#2F5B41]"
                  checked={form.livelli.includes(l)}
                  onChange={(e) => setForm({ ...form, livelli: e.target.checked ? [...form.livelli, l].sort() : form.livelli.filter((x) => x !== l) })} />
                L{l} {l === 1 ? "(operatore)" : l === 2 ? "(responsabile)" : "(dirigente)"}
              </label>
            ))}
          </div>
          {!form.id && (
            <>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-5 mb-2">Utenze comunali ({form.utenze.length})</div>
              {form.utenze.map((u, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 text-xs bg-[#FAFAF8] border border-slate-100 rounded-xl px-3 py-2 mb-1.5">
                  <span className="font-bold rounded-full bg-[#2F5B41] text-white px-2 py-0.5">L{u.livello}</span>
                  <span className="font-bold">{u.nome}</span><span className="text-slate-500 flex-1">{u.email}</span>
                  <button type="button" onClick={() => setForm({ ...form, utenze: form.utenze.filter((_, j) => j !== i) })}
                    className="border border-slate-200 rounded-lg p-1 hover:border-[#EF4444] hover:text-[#EF4444]"><Trash2 size={12} /></button>
                </div>
              ))}
              <div className="grid md:grid-cols-5 gap-2 mt-2">
                <input data-testid="utenza-nome" className={input} placeholder="Nome" value={nuovaUt.nome} onChange={(e) => setNuovaUt({ ...nuovaUt, nome: e.target.value })} />
                <input data-testid="utenza-email" className={input} placeholder="Email" value={nuovaUt.email} onChange={(e) => setNuovaUt({ ...nuovaUt, email: e.target.value })} />
                <input data-testid="utenza-password" className={input} placeholder="Password" value={nuovaUt.password} onChange={(e) => setNuovaUt({ ...nuovaUt, password: e.target.value })} />
                <select data-testid="utenza-livello" className={input} value={nuovaUt.livello} onChange={(e) => setNuovaUt({ ...nuovaUt, livello: parseInt(e.target.value) })}>
                  {form.livelli.map((l) => <option key={l} value={l}>L{l}</option>)}
                </select>
                <button type="button" data-testid="aggiungi-utenza-btn" onClick={() => {
                  if (!nuovaUt.nome || !nuovaUt.email || !nuovaUt.password) return toast.error("Compila nome, email e password");
                  setForm({ ...form, utenze: [...form.utenze, { ...nuovaUt }] });
                  setNuovaUt({ ...NUOVA_UTENZA, livello: form.livelli[0] || 1 });
                }} className="border border-slate-200 rounded-full px-4 py-2 text-sm font-bold hover:border-[#2F5B41] hover:text-[#2F5B41] transition-colors">+ Aggiungi utenza</button>
              </div>
            </>
          )}
          <div className="mt-5 flex gap-3">
            <button data-testid="onboard-submit" className="px-6 py-2.5 font-bold rounded-full bg-[#2F5B41] text-white hover:bg-[#26492F] transition-colors">{form.id ? "Salva modifiche" : "Attiva comune"}</button>
            <button type="button" onClick={() => setForm(null)} className="px-6 py-2.5 font-bold border border-slate-200 rounded-full hover:border-[#2F5B41] transition-colors">Annulla</button>
          </div>
        </form>
      )}

      {utentiPanel && (
        <div className="mt-6 border border-slate-100 bg-white rounded-2xl overflow-hidden" data-testid="utenti-panel">
          <div className="px-5 py-3 bg-[#FAFAF8] border-b border-slate-100 flex items-center justify-between">
            <span className="font-heading font-extrabold">Utenze e livelli — Comune di {utentiPanel.comune.nome} ({(utentiPanel.comune.livelli_attivi || []).map((l) => `L${l}`).join(" + ")})</span>
            <button onClick={() => setUtentiPanel(null)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">Chiudi ✕</button>
          </div>
          <div className="p-5 space-y-2">
            {utentiPanel.utenti.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 border border-slate-100 rounded-xl px-4 py-2 text-sm" data-testid={`utente-row-${u.id}`}>
                <span className="font-bold rounded-full bg-[#2F5B41] text-white px-2.5 py-0.5 text-xs">L{u.livello}</span>
                <span className="font-bold">{u.nome}</span>
                <span className="text-slate-500 flex-1">{u.email}</span>
                <span className={`text-[10px] font-bold rounded-full px-2.5 py-1 ${u.attivo !== false ? "bg-[#D8EADB] text-[#1F5B33]" : "bg-[#FEE2E2] text-[#B91C1C]"}`}>{u.attivo !== false ? "Attivo" : "Disabilitato"}</span>
                <button data-testid={`toggle-utente-${u.id}`} onClick={() => toggleAttivo(u)}
                  className="border border-slate-200 rounded-full px-3 py-1 text-xs font-bold hover:border-[#2F5B41] transition-colors">
                  {u.attivo !== false ? "Disabilita" : "Riattiva"}
                </button>
              </div>
            ))}
            {utentiPanel.utenti.length === 0 && <div className="text-sm text-slate-500">Nessuna utenza.</div>}
            <div className="grid md:grid-cols-5 gap-2 pt-3 border-t border-dashed border-slate-200">
              <input className={input} placeholder="Nome" value={utentiPanel.nuova.nome} onChange={(e) => setUtentiPanel({ ...utentiPanel, nuova: { ...utentiPanel.nuova, nome: e.target.value } })} />
              <input data-testid="panel-utenza-email" className={input} placeholder="Email" value={utentiPanel.nuova.email} onChange={(e) => setUtentiPanel({ ...utentiPanel, nuova: { ...utentiPanel.nuova, email: e.target.value } })} />
              <input className={input} placeholder="Password" value={utentiPanel.nuova.password} onChange={(e) => setUtentiPanel({ ...utentiPanel, nuova: { ...utentiPanel.nuova, password: e.target.value } })} />
              <select className={input} value={utentiPanel.nuova.livello} onChange={(e) => setUtentiPanel({ ...utentiPanel, nuova: { ...utentiPanel.nuova, livello: parseInt(e.target.value) } })}>
                {(utentiPanel.comune.livelli_attivi || [1, 2, 3]).map((l) => <option key={l} value={l}>L{l}</option>)}
              </select>
              <button data-testid="panel-aggiungi-utenza" onClick={aggiungiUtente}
                className="border border-slate-200 rounded-full px-4 py-2 text-sm font-bold hover:border-[#2F5B41] hover:text-[#2F5B41] transition-colors">+ Crea utenza</button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 border border-slate-100 bg-white rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#FAFAF8] border-b border-slate-100 text-left">
              {["Comune", "Zone", "Impianti", "Circuiti", "Aree OSP", "Pratiche", "Incasso", "Livelli", "Stato", "Azioni"].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comuni.map((c) => (
              <tr key={c.id} className="border-b border-slate-200 hover:bg-[#F1F5F0] transition-colors" data-testid={`comune-row-${c.id}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {c.logo_url ? (
                      <img src={imgSrc(c.logo_url)} alt="" className="w-9 h-9 rounded-lg object-contain border border-slate-100 bg-white" />
                    ) : (
                      <span className="w-9 h-9 rounded-lg bg-[#EEF2EC] flex items-center justify-center text-[#2F5B41]"><Landmark size={16} /></span>
                    )}
                    <div><div className="font-bold">{c.nome}</div><div className="text-xs text-slate-400">{c.provincia}</div></div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono">{c.zone_count}</td>
                <td className="px-4 py-3 font-mono">{c.impianti_count}</td>
                <td className="px-4 py-3 font-mono">{c.pacchetti_count}</td>
                <td className="px-4 py-3 font-mono">{c.spazi_count}</td>
                <td className="px-4 py-3 font-mono">{c.pratiche_count}</td>
                <td className="px-4 py-3 font-heading font-extrabold">{c.incasso_totale.toFixed(2)} €</td>
                <td className="px-4 py-3 text-xs font-bold">{(c.livelli_attivi || [1, 2, 3]).map((l) => `L${l}`).join(" ")}</td>
                <td className="px-4 py-3">
                  <select data-testid={`stato-comune-${c.id}`} value={c.stato_onboarding || "ATTIVO"}
                    onClick={(e) => e.stopPropagation()}
                    onChange={async (e) => {
                      try {
                        await api.patch(`/admin/comuni/${c.id}/stato`, { stato_onboarding: e.target.value });
                        toast.success(`${c.nome}: ${e.target.value}`);
                        load();
                      } catch (err) { toast.error(apiError(err)); }
                    }}
                    className={`text-[11px] font-bold rounded-full px-2 py-1 border cursor-pointer ${(c.stato_onboarding || "ATTIVO") === "ATTIVO" ? "bg-[#D8EADB] text-[#1F5B33] border-[#D8EADB]" : "bg-[#FEF3C7] text-[#B45309] border-[#FEF3C7]"}`}>
                    {["DA_CONFIGURARE", "IN_CONFIGURAZIONE", "ATTIVO", "SOSPESO", "DISATTIVATO"].map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button data-testid={`utenti-comune-${c.id}`} onClick={() => openUtenti(c)} title="Utenze e livelli"
                      className="border border-slate-200 rounded-lg p-1.5 hover:border-[#2F5B41] transition-colors"><Users size={14} /></button>
                    <button data-testid={`edit-comune-${c.id}`} onClick={() => openEdit(c)} title="Modifica"
                      className="border border-slate-200 rounded-lg p-1.5 hover:border-[#2F5B41] transition-colors"><Pencil size={14} /></button>
                    <button data-testid={`delete-comune-${c.id}`} onClick={() => remove(c)} title="Elimina"
                      className="border border-slate-200 rounded-lg p-1.5 hover:border-[#EF4444] hover:text-[#EF4444] transition-colors"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BackofficeLayout>
  );
}
