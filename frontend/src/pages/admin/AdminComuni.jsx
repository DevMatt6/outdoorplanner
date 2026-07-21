import { useEffect, useState } from "react";
import { BackofficeLayout, ADMIN_LINKS } from "../../components/BackofficeLayout";
import { api, apiError, imgSrc } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Upload, Landmark, Pencil, Trash2 } from "lucide-react";

const EMPTY = { nome: "", regione: "", provincia: "", lat: "", lng: "", logo_url: "", referente_nome: "", referente_email: "", referente_password: "" };

const REGIONI = ["Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche", "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia", "Toscana", "Trentino-Alto Adige/Südtirol", "Umbria", "Valle d'Aosta/Vallée d'Aoste", "Veneto"];

export default function AdminComuni() {
  const [comuni, setComuni] = useState([]);
  const [form, setForm] = useState(null);

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
        await api.put(`/admin/comuni/${form.id}`, payload);
        toast.success(`Comune ${form.nome} aggiornato`);
      } else {
        await api.post("/admin/comuni", payload);
        toast.success(`Comune ${form.nome} attivato con referente ${form.referente_email}`);
      }
      setForm(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const openEdit = (c) => setForm({ id: c.id, nome: c.nome, regione: c.regione, provincia: c.provincia, lat: c.lat, lng: c.lng, logo_url: c.logo_url || "" });

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
          {!form.id && (
            <>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-5 mb-2">Account referente</div>
              <div className="grid md:grid-cols-3 gap-3">
                <input data-testid="onboard-ref-nome" className={input} placeholder="Nome referente" required value={form.referente_nome} onChange={(e) => setForm({ ...form, referente_nome: e.target.value })} />
                <input data-testid="onboard-ref-email" className={input} type="email" placeholder="Email referente" required value={form.referente_email} onChange={(e) => setForm({ ...form, referente_email: e.target.value })} />
                <input data-testid="onboard-ref-password" className={input} placeholder="Password" required value={form.referente_password} onChange={(e) => setForm({ ...form, referente_password: e.target.value })} />
              </div>
            </>
          )}
          <div className="mt-5 flex gap-3">
            <button data-testid="onboard-submit" className="px-6 py-2.5 font-bold rounded-full bg-[#2F5B41] text-white hover:bg-[#26492F] transition-colors">{form.id ? "Salva modifiche" : "Attiva comune"}</button>
            <button type="button" onClick={() => setForm(null)} className="px-6 py-2.5 font-bold border border-slate-200 rounded-full hover:border-[#2F5B41] transition-colors">Annulla</button>
          </div>
        </form>
      )}

      <div className="mt-6 border border-slate-100 bg-white rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#FAFAF8] border-b border-slate-100 text-left">
              {["Comune", "Regione", "Spazi", "Pratiche", "Approvate", "Incasso", "Fee 5%", "Stato", "Azioni"].map((h) => (
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
                <td className="px-4 py-3">{c.regione}</td>
                <td className="px-4 py-3 font-mono">{c.spazi_attivi}/{c.spazi_count}</td>
                <td className="px-4 py-3 font-mono">{c.pratiche_count}</td>
                <td className="px-4 py-3 font-mono">{c.approvate}</td>
                <td className="px-4 py-3 font-heading font-extrabold">{c.incasso_totale.toFixed(2)} €</td>
                <td className="px-4 py-3 font-mono text-slate-500">{c.incasso_piattaforma.toFixed(2)} €</td>
                <td className="px-4 py-3">
                  <span className="text-[10px] font-bold rounded-full px-2.5 py-1 bg-[#D8EADB] text-[#1F5B33]">Attivo</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
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
