import { useEffect, useState } from "react";
import { DynamicField, isVisible } from "./DynamicField";
import { api, apiError } from "../lib/api";
import { toast } from "sonner";
import { Save, Upload } from "lucide-react";

const BK = process.env.REACT_APP_BACKEND_URL;

export const IntegrazioneEditor = ({ pratica, reload }) => {
  const isOOH = pratica.tipo === "OOH";
  const [template, setTemplate] = useState(null);
  const [values, setValues] = useState(pratica.dati_form || {});
  const [soggetti, setSoggetti] = useState([]);

  useEffect(() => {
    const url = isOOH ? `/ooh/pratiche/${pratica.id}/template` : `/form-templates/spazio/${pratica.spazio_id}`;
    api.get(url).then(({ data }) => setTemplate(data)).catch(() => setTemplate({ campi: [] }));
    if (isOOH && pratica.campagna_id) {
      api.get(`/ooh/campagne/${pratica.campagna_id}/soggetti`).then(({ data }) => setSoggetti(data)).catch(() => {});
    }
  }, [pratica.id]);

  const salvaDati = async () => {
    try {
      if (isOOH) await api.put(`/ooh/pratiche/${pratica.id}/dati-form`, { dati_form: values });
      else await api.put(`/pratiche/${pratica.id}`, { dati_form: values });
      toast.success("Dati del modulo aggiornati");
      reload();
    } catch (e) { toast.error(apiError(e)); }
  };

  const assegna = async (impiantoId, soggettoId) => {
    if (!soggettoId) return;
    try {
      await api.post(`/ooh/pratiche/${pratica.id}/creativita`, { impianto_id: impiantoId, soggetto_id: soggettoId });
      toast.success("Creatività aggiornata");
      reload();
    } catch (e) { toast.error(apiError(e)); }
  };

  const uploadSoggetto = async (formato, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/ooh/campagne/${pratica.campagna_id}/soggetti?formato=${encodeURIComponent(formato)}&nome=${encodeURIComponent(`Soggetto sostitutivo — ${formato}`)}`, fd);
      const { data } = await api.get(`/ooh/campagne/${pratica.campagna_id}/soggetti`);
      setSoggetti(data);
      toast.success("Nuovo soggetto caricato: assegnalo all'impianto desiderato");
    } catch (e) { toast.error(apiError(e)); }
  };

  const campi = (template?.campi || []).filter((c) => isVisible(c, values));
  const assegnataA = (impId) => (pratica.creativita || []).find((a) => a.impianto_id === impId)?.soggetto_id || "";
  const formati = [...new Set((pratica.impianti || []).map((i) => i.formato).filter(Boolean))];
  const richieste = pratica.integrazione_richieste || [];
  const campiRichiesti = new Set(richieste.filter((r) => r.tipo === "campo").map((r) => r.id));
  const creativitaRichieste = new Set(richieste.filter((r) => r.tipo === "creativita").map((r) => r.id));
  const notaPer = (tipo, id) => richieste.find((r) => r.tipo === tipo && r.id === id)?.nota;

  return (
    <div className="mt-5 space-y-5" data-testid="integrazione-editor">
      {campi.length > 0 && (
        <div className="bg-white border border-[#E9ECEF] rounded-2xl p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Correggi i dati del modulo</div>
          <div className="grid sm:grid-cols-2 gap-4">
            {campi.map((c) => (
              <div key={c.id} className={campiRichiesti.has(c.id) ? "rounded-xl ring-2 ring-[#B45309]/60 p-2 bg-amber-50/50" : ""}>
                <DynamicField campo={c} value={values[c.id]} onChange={(v) => setValues({ ...values, [c.id]: v })} />
                {campiRichiesti.has(c.id) && (
                  <div className="text-[11px] font-bold text-[#B45309] mt-1" data-testid={`richiesta-campo-${c.id}`}>
                    Da correggere{notaPer("campo", c.id) ? `: "${notaPer("campo", c.id)}"` : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button data-testid="salva-dati-integrazione" onClick={salvaDati}
            className="mt-4 inline-flex items-center gap-2 bg-[#1F3BB3] text-white rounded-full px-5 py-2.5 text-sm font-bold hover:bg-[#172E93] transition-colors">
            <Save size={15} /> Salva dati modulo
          </button>
        </div>
      )}

      {isOOH && (pratica.impianti || []).length > 0 && (
        <div className="bg-white border border-[#E9ECEF] rounded-2xl p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Correggi le creatività</div>
          <div className="space-y-3">
            {pratica.impianti.map((i) => {
              const compatibili = soggetti.filter((s) => s.formato === i.formato);
              const daCorreggere = creativitaRichieste.has(i.id);
              return (
                <div key={i.id} className={`flex flex-wrap items-center gap-3 border rounded-xl px-4 py-3 ${daCorreggere ? "border-[#B45309] ring-2 ring-[#B45309]/40 bg-amber-50/50" : "border-[#E5E9F2]"}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{i.codice} <span className="font-normal text-slate-500">· {i.formato}</span></div>
                    {daCorreggere && (
                      <div className="text-[11px] font-bold text-[#B45309]" data-testid={`richiesta-creativita-${i.codice}`}>
                        Da sostituire{notaPer("creativita", i.id) ? `: "${notaPer("creativita", i.id)}"` : ""}
                      </div>
                    )}
                  </div>
                  <select data-testid={`select-creativita-${i.codice}`} value={assegnataA(i.id)}
                    onChange={(e) => assegna(i.id, e.target.value)}
                    className="border border-[#DDE2EC] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1F3BB3] bg-white max-w-[220px]">
                    <option value="">— Scegli soggetto —</option>
                    {compatibili.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {formati.map((f) => (
              <label key={f} className="cursor-pointer inline-flex items-center gap-2 border border-[#DDE2EC] bg-white rounded-full px-4 py-2 text-xs font-bold hover:border-[#1F3BB3] hover:text-[#1F3BB3] transition-colors">
                <Upload size={13} /> Nuovo soggetto {f}
                <input data-testid={`upload-soggetto-${f}`} type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.gif"
                  onChange={(e) => uploadSoggetto(f, e.target.files[0])} />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
