import { FileImage } from "lucide-react";

const BK = process.env.REACT_APP_BACKEND_URL;
const LABELS = {
  nome: "Nome / Referente", email: "Email", tipo_soggetto: "Tipo soggetto",
  ragione_sociale: "Ragione sociale", partita_iva: "Partita IVA",
  codice_fiscale: "Codice fiscale", pec: "PEC", telefono: "Telefono",
};
const isImg = (u) => /\.(jpg|jpeg|png|webp|gif)$/i.test(u || "");

const Box = ({ title, children, testId }) => (
  <div className="border border-slate-100 bg-white rounded-2xl overflow-hidden" data-testid={testId}>
    <div className="px-5 py-2.5 border-b border-slate-100 text-xs font-bold uppercase tracking-widest bg-[#F8F9FD]">{title}</div>
    {children}
  </div>
);

export const SezioneRichiedente = ({ richiedente }) => {
  const entries = Object.entries(richiedente || {}).filter(([, v]) => v);
  if (!entries.length) return null;
  return (
    <Box title="Dati richiedente (autocompilati dalla registrazione)" testId="sezione-richiedente">
      <div className="p-5 grid grid-cols-2 gap-3 text-sm">
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{LABELS[k] || k.replaceAll("_", " ")}</div>
            <div className="font-semibold break-all">{String(v)}</div>
          </div>
        ))}
      </div>
    </Box>
  );
};

export const SezionePrenotazione = ({ pratica }) => {
  const pren = pratica.prenotazione;
  const rows = [
    ["Tipo pratica", pratica.tipo === "OOH" ? "Campagna OOH" : "Occupazione suolo (OSP)"],
    pratica.campagna_nome && ["Campagna", pratica.campagna_nome],
    ["Periodo", `${pratica.data_inizio} → ${pratica.data_fine}`],
    pratica.zona_nome && ["Zona", pratica.zona_nome],
    pratica.pacchetto_nome && ["Circuito", pratica.pacchetto_nome],
    ["Importo", `${pratica.importo.toFixed(2)} €`],
    ["Pagamento", pratica.pagata ? "Pagata ✓" : "Non pagata"],
    pren && ["Stato prenotazione", pren.stato],
  ].filter(Boolean);
  return (
    <Box title="Dettagli prenotazione" testId="sezione-prenotazione">
      <div className="p-5 grid grid-cols-2 gap-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k}>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{k}</div>
            <div className="font-semibold">{v}</div>
          </div>
        ))}
      </div>
    </Box>
  );
};

export const SezioneImpiantiCreativita = ({ pratica }) => {
  const impianti = pratica.impianti || [];
  if (!impianti.length) return null;
  const assegnata = (impId) => (pratica.creativita_dettagli || []).find((c) => c.impianto_id === impId)?.soggetto;
  return (
    <Box title={`Impianti e creatività (${impianti.length})`} testId="sezione-impianti">
      {impianti.map((i) => {
        const sog = assegnata(i.id);
        return (
          <div key={i.id} className="flex items-start gap-4 px-5 py-4 border-b border-slate-100 last:border-b-0" data-testid={`impianto-row-${i.codice}`}>
            {i.foto_url ? (
              <img src={i.foto_url.startsWith("/") ? `${BK}${i.foto_url}` : i.foto_url} alt={i.codice}
                className="w-16 h-16 object-cover rounded-xl border border-slate-100 shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-[#F0F4FF] flex items-center justify-center shrink-0"><FileImage size={20} className="text-slate-400" /></div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">{i.codice} {i.via && <span className="font-normal text-slate-500">· {i.via}</span>}</div>
              <div className="text-xs text-slate-500 mt-0.5">{i.tipologia} · formato {i.formato}</div>
              <div className="mt-2 text-xs">
                {sog ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 bg-[#E8EFFF] text-[#1F3BB3] font-bold rounded-full px-2.5 py-1">Creatività: {sog.nome}</span>
                    <a href={`${BK}${sog.file_url}`} target="_blank" rel="noreferrer"
                      className="font-semibold underline text-slate-600 hover:text-slate-900" data-testid={`creativita-file-${i.codice}`}>
                      {sog.file_nome || "Apri file"}
                    </a>
                    {isImg(sog.file_url) && (
                      <a href={`${BK}${sog.file_url}`} target="_blank" rel="noreferrer">
                        <img src={`${BK}${sog.file_url}`} alt={sog.nome} className="h-10 rounded-lg border border-slate-100" />
                      </a>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">Nessuna creatività assegnata</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </Box>
  );
};

export const SezioneDatiForm = ({ dati }) => {
  const entries = Object.entries(dati || {});
  if (!entries.length) return null;
  return (
    <Box title="Dati dichiarati nel modulo" testId="sezione-dati-form">
      <div className="p-5 grid grid-cols-2 gap-3 text-sm">
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{k.replaceAll("_", " ")}</div>
            <div className="font-semibold break-all">{String(v === true ? "Sì" : v === false ? "No" : v)}</div>
          </div>
        ))}
      </div>
    </Box>
  );
};

export const SezioneDocumenti = ({ documenti }) => (
  <Box title={`Documenti caricati (${(documenti || []).length})`} testId="sezione-documenti">
    {(documenti || []).length === 0 && <div className="p-5 text-sm text-slate-500">Nessun documento caricato.</div>}
    {(documenti || []).map((d) => (
      <a key={d.id} href={`${BK}${d.url}`} target="_blank" rel="noreferrer"
        className="flex justify-between px-5 py-3 border-b border-slate-100 last:border-b-0 text-sm hover:bg-[#F0F4FF] transition-colors">
        <span className="font-semibold">{d.nome}</span>
        <span className="text-xs text-slate-500 uppercase">{d.tipo}</span>
      </a>
    ))}
  </Box>
);
