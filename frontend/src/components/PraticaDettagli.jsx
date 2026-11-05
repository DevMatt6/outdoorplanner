import { CreativeGallery, creativeLabel } from "./CreativeGallery";
import { imgSrc } from "../lib/api";
import { installationGroups } from "../lib/practicePresentation";
import { FileImage } from "lucide-react";

const LABELS = {
  nome: "Nome / Referente", email: "Email", tipo_soggetto: "Tipo soggetto",
  ragione_sociale: "Ragione sociale", partita_iva: "Partita IVA",
  codice_fiscale: "Codice fiscale", pec: "PEC", telefono: "Telefono",
};

const Box = ({ title, children, testId }) => (
  <div className="border border-slate-100 bg-card rounded-xl overflow-hidden" data-testid={testId}>
    <div className="px-5 py-2.5 border-b border-slate-100 text-xs font-semibold tracking-normal bg-muted">{title}</div>
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
            <div className="text-[10px] tracking-normal text-slate-400 font-semibold">{LABELS[k] || k.replaceAll("_", " ")}</div>
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
    pratica.tipo !== "OOH" && pratica.pacchetto_nome && ["Circuito", pratica.pacchetto_nome],
    ["Importo", `${pratica.importo.toFixed(2)} €`],
    ["Pagamento", pratica.pagata ? "Pagata ✓" : "Non pagata"],
    pren && ["Stato prenotazione", pren.stato],
  ].filter(Boolean);
  return (
    <Box title="Dettagli prenotazione" testId="sezione-prenotazione">
      <div className="p-5 grid grid-cols-2 gap-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k}>
            <div className="text-[10px] tracking-normal text-slate-400 font-semibold">{k}</div>
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
    <><Box title={`Impianti e creatività (${impianti.length})`} testId="sezione-impianti">
      {installationGroups(pratica).map(group => <section key={group.zona}>
        <h3 className="border-b bg-muted/50 px-5 py-3 text-sm font-semibold">{group.zona} · {group.impianti.length} impianti</h3>
        {group.impianti.map((i) => {
        const sog = assegnata(i.id);
        return (
          <div key={i.id} className="flex items-start gap-4 px-5 py-4 border-b border-slate-100 last:border-b-0" data-testid={`impianto-row-${i.codice}`}>
            {i.foto_url ? (
              <img src={imgSrc(i.foto_url)} alt={i.codice}
                className="w-16 h-16 object-cover rounded-xl border border-slate-100 shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-accent flex items-center justify-center shrink-0"><FileImage size={20} className="text-slate-400" /></div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{i.codice} {i.via && <span className="font-normal text-slate-500">· {i.via}</span>}</div>
              {i.circuito_nome && <div className="text-xs text-muted-foreground">Circuito: {i.circuito_nome}</div>}
              <div className="text-xs text-slate-500 mt-0.5">{i.tipologia} · formato {i.formato}</div>
              <div className="mt-2 text-xs">
                {sog ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 font-semibold text-brand-foreground">Creatività: {creativeLabel(sog)}</span>
                ) : (
                  <span className="text-slate-400 italic">Nessuna creatività assegnata</span>
                )}
              </div>
            </div>
          </div>
        );
      })}</section>)}
    </Box>
    <CreativeGallery subjects={(pratica.creativita_dettagli || []).map(c => c.soggetto)} /></>
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
            <div className="text-[10px] tracking-normal text-slate-400 font-semibold">{k.replaceAll("_", " ")}</div>
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
      <a key={d.id} href={imgSrc(d.url)} target="_blank" rel="noreferrer"
        className="flex justify-between px-5 py-3 border-b border-slate-100 last:border-b-0 text-sm hover:bg-accent transition-colors">
        <span className="font-semibold">{d.nome}</span>
        <span className="text-xs text-slate-500 uppercase">{d.tipo}</span>
      </a>
    ))}
  </Box>
);
