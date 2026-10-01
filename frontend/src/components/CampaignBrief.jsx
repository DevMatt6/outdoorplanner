export const OBJECTIVES = [
  ['awareness', 'Brand Awareness', 'Distribuire la presenza sul territorio e privilegiare formati di impatto.'],
  ['engagement', 'Consideration & Engagement', 'Cercare contesti adatti all’interazione e alla scoperta del brand.'],
  ['conversion', 'Conversion / Drive-to-Store', 'Privilegiare contesti commerciali e la vicinanza al punto vendita.'],
];
export const AUDIENCES = [['studenti','Studenti'],['famiglie','Famiglie'],['pendolari','Pendolari'],['turisti','Turisti']];
export const CONTEXTS = [['centro','Centro'],['commerciale','Commerciale'],['stazione','Stazioni'],['universita','Università'],['residenziale','Residenziale']];
export const ACTIVITIES = [['evento','Evento'],['sampling','Sampling'],['stand','Stand'],['installazione','Installazione']];
export const initialBrief = () => ({ obiettivo: '', budget: '', pubblici: [], contesti: [], formato: 'qualsiasi', distribuzione: 'tutti', punto_vendita: '', lat: '', lng: '', raggio_km: 5, attivita: '', superficie_mq: '' });
export const briefPayload = (brief, cities) => ({ ...brief, budget: Number(brief.budget), comuni_ids: cities, lat: brief.lat === '' ? null : Number(brief.lat), lng: brief.lng === '' ? null : Number(brief.lng), raggio_km: Number(brief.raggio_km), attivita: brief.attivita || null, superficie_mq: brief.superficie_mq === '' ? null : Number(brief.superficie_mq) });
export function briefError(b) {
  if (!b.obiettivo) return 'Seleziona l’obiettivo della campagna';
  if (!Number.isFinite(Number(b.budget)) || Number(b.budget) < 0.01) return 'Inserisci un budget di almeno 0,01 €';
  if ((b.lat === '') !== (b.lng === '')) return 'Inserisci entrambe le coordinate del punto vendita';
  if (b.lat !== '' && (Math.abs(Number(b.lat)) > 90 || Math.abs(Number(b.lng)) > 180)) return 'Coordinate del punto vendita non valide';
  if (b.superficie_mq !== '' && Number(b.superficie_mq) <= 0) return 'Inserisci una superficie maggiore di zero';
  if (Number(b.raggio_km) <= 0 || Number(b.raggio_km) > 100) return 'Inserisci un raggio tra 0 e 100 km';
  return '';
}
const input = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white';
function Choices({ label, options, value, onChange }) {
  return <fieldset><legend className="text-sm font-bold mb-2">{label}</legend><div className="flex flex-wrap gap-2">{options.map(([key, text]) => <label key={key} className="border rounded-xl px-3 py-2 text-sm"><input type="checkbox" className="mr-2 accent-[#1F3BB3]" checked={value.includes(key)} onChange={() => onChange(value.includes(key) ? value.filter(x => x !== key) : [...value, key])} />{text}</label>)}</div></fieldset>;
}
export function CampaignBrief({ value, onChange, tipo }) {
  const set = (key, v) => onChange({ ...value, [key]: v });
  return <div className="space-y-6" data-testid="campaign-brief">
    <h2 className="text-xl font-extrabold">Obiettivo e budget</h2>
    <div className="grid md:grid-cols-3 gap-3">{OBJECTIVES.map(([key, title, description]) => <button key={key} type="button" data-testid={`objective-${key}`} onClick={() => set('obiettivo', key)} aria-pressed={value.obiettivo === key} className={`text-left border rounded-2xl p-5 ${value.obiettivo === key ? 'border-[#1F3BB3] bg-[#F0F4FF] ring-1 ring-[#1F3BB3]' : 'border-slate-200'}`}><strong>{title}</strong><p className="mt-2 text-sm text-slate-500">{description}</p></button>)}</div>
    <label className="block max-w-md text-sm font-bold">Budget massimo per l’intero periodo (€)<input data-testid="campaign-budget" className={`${input} mt-2`} type="number" min="0.01" step="0.01" value={value.budget} onChange={e => set('budget', e.target.value)} /></label>
    <p className="text-xs text-slate-500">Il budget copre i canoni degli spazi o impianti. Produzione, stampa, allestimento, creatività ed eventuali costi aggiuntivi non sono inclusi.</p>
    <Choices label="Pubblico preferito (facoltativo; nessuna scelta = generico)" options={AUDIENCES} value={value.pubblici} onChange={v => set('pubblici', v)} />
    <Choices label="Contesti preferiti (facoltativo)" options={CONTEXTS} value={value.contesti} onChange={v => set('contesti', v)} />
    <div className="grid md:grid-cols-2 gap-4">
      <label className="text-sm font-bold">Distribuzione<select className={`${input} mt-2`} value={value.distribuzione} onChange={e => set('distribuzione', e.target.value)}><option value="tutti">Presenza in tutti i comuni selezionati</option><option value="migliore">Migliore combinazione complessiva</option></select></label>
      {tipo === 'OOH' && <label className="text-sm font-bold">Formato richiesto<select className={`${input} mt-2`} value={value.formato} onChange={e => set('formato', e.target.value)}><option value="qualsiasi">Qualsiasi</option><option value="cartaceo">Cartaceo</option><option value="digitale">Digitale</option><option value="maxi">Maxi affissione</option></select></label>}
      {tipo === 'OSP' && <><label className="text-sm font-bold">Attività richiesta<select className={`${input} mt-2`} value={value.attivita} onChange={e => set('attivita', e.target.value)}><option value="">Nessun requisito</option>{ACTIVITIES.map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label><label className="text-sm font-bold">Superficie minima (m², facoltativa)<input className={`${input} mt-2`} type="number" min="0.01" step="any" value={value.superficie_mq} onChange={e => set('superficie_mq', e.target.value)} /></label></>}
    </div>
    {value.obiettivo === 'conversion' && <fieldset className="border rounded-2xl p-4 space-y-3"><legend className="font-bold">Punto vendita (facoltativo)</legend><input className={input} placeholder="Indirizzo del punto vendita" aria-label="Indirizzo punto vendita" value={value.punto_vendita} onChange={e => set('punto_vendita', e.target.value)} /><div className="grid md:grid-cols-3 gap-3">{[['lat','Latitudine'],['lng','Longitudine'],['raggio_km','Raggio in km']].map(([key, title]) => <label key={key} className="text-sm">{title}<input className={input} type="number" step="any" value={value[key]} onChange={e => set(key, e.target.value)} /></label>)}</div><p className="text-xs text-slate-500">Per il filtro di vicinanza servono le coordinate del punto vendita. Il raggio è calcolato in linea d’aria; l’indirizzo da solo non viene geocodificato.</p></fieldset>}
    <p className="text-xs text-slate-500">I suggerimenti usano disponibilità, prezzi e attributi del catalogo. Non rappresentano previsioni di impression, affluenza o conversioni.</p>
  </div>;
}
export function BudgetSummary({ brief, total, perCity = {} }) {
  return <div className={`rounded-xl border p-4 text-sm ${total > Number(brief.budget) + 0.001 ? 'border-red-200 bg-red-50' : 'border-blue-100 bg-blue-50'}`} data-testid="budget-summary"><div className="flex flex-wrap justify-between gap-2"><strong>Selezione: {total.toFixed(2)} €</strong><span>Budget: {Number(brief.budget).toFixed(2)} € · Residuo: {(Number(brief.budget)-total).toFixed(2)} €</span></div>{Object.entries(perCity).map(([city, amount]) => <div key={city} className="mt-1">{city}: {amount.toFixed(2)} €</div>)}{total > Number(brief.budget) + 0.001 && <p className="mt-2 font-bold">Rimuovi alcuni spazi o aumenta il budget per proseguire.</p>}</div>;
}
export function RecommendationPanel({ proposal, busy, error, onCalculate, onApply, onExclude, cityName }) {
  return <section className="border border-blue-100 rounded-2xl p-5 space-y-3" data-testid="recommendation-panel"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-extrabold text-lg">Proposta per la tua campagna</h2><p className="text-sm text-slate-500">Disponibilità verificata al momento del calcolo. Puoi applicare e modificare la selezione.</p></div><button type="button" disabled={busy} onClick={onCalculate} className="rounded-full border px-5 py-2 font-bold disabled:opacity-50">{busy ? 'Calcolo…' : 'Ricalcola suggerimenti'}</button></div>{error && <p role="alert" className="text-red-700">{error}</p>}{proposal && <><div className="font-bold">{proposal.items.length} spazi · {proposal.totale.toFixed(2)} € · Residuo {proposal.residuo.toFixed(2)} €</div>{proposal.avvisi.map((warning, n) => <p key={n} className="text-sm text-amber-800">{warning}</p>)}{Object.entries(proposal.per_comune).map(([id, amount]) => <p key={id} className="text-sm">{cityName(id)}: {amount.toFixed(2)} €</p>)}<div className="grid md:grid-cols-2 gap-3">{proposal.items.map(i => <div key={i.id} className="border rounded-xl p-3 bg-white"><strong>{i.codice || i.nome}</strong><div className="text-xs text-slate-500">{cityName(i.comune_id)} · {i.circuito_nome || i.zona_nome || i.zona} · {i.costo.toFixed(2)} €</div><ul className="mt-2 text-xs text-slate-600 space-y-1">{i.motivi.map((r, n) => <li key={n}>{r}</li>)}</ul><button type="button" className="text-xs font-bold text-[#1F3BB3] mt-2" disabled={busy} onClick={() => onExclude(i.id)}>Escludi e cerca un’alternativa</button></div>)}</div><button type="button" disabled={busy || !proposal.fattibile} onClick={onApply} className="bg-[#1F3BB3] text-white rounded-full px-5 py-2 font-bold disabled:opacity-40">Applica proposta</button></>}</section>;
}
export function CatalogPlanningFields({ value, onChange, osp = false }) {
  return <div className="space-y-3 border rounded-xl p-4"><p className="text-sm font-bold">Dati per i suggerimenti di campagna</p><Choices label="Contesti effettivi" options={CONTEXTS} value={value.contesti || []} onChange={v => onChange({ ...value, contesti: v })} /><Choices label="Pubblici pertinenti" options={AUDIENCES} value={value.pubblici || []} onChange={v => onChange({ ...value, pubblici: v })} />{osp && <><Choices label="Attività ammesse" options={ACTIVITIES} value={value.attivita_ammesse || []} onChange={v => onChange({ ...value, attivita_ammesse: v })} /><label className="block text-sm">Superficie disponibile (m²)<input className={input} type="number" min="0.01" step="any" value={value.superficie_mq ?? ''} onChange={e => onChange({ ...value, superficie_mq: e.target.value === '' ? null : Number(e.target.value) })} /></label></>}<p className="text-xs text-slate-500">Inserisci solo caratteristiche note. Lascia vuoti i dati non disponibili.</p></div>;
}

export function catalogCompatible(item, brief, tipo, days) {
  if (days < (item.giorni_minimi || 1) || item.attivo === false || item.occupato) return false;
  if (tipo === 'OOH' && brief.formato !== 'qualsiasi') {
    const text = (item.tipologia || '').toLowerCase();
    const kind = item.categoria === 'dooh' || /digitale|ledwall|schermo/.test(text) ? 'digitale' : item.categoria === 'maxi' || /poster maxi|mega poster/.test(text) ? 'maxi' : 'cartaceo';
    if (kind !== brief.formato) return false;
  }
  if (tipo === 'OSP') {
    if (brief.attivita && !(item.attivita_ammesse || []).includes(brief.attivita)) return false;
    if (brief.superficie_mq !== '' && (item.superficie_mq || 0) < Number(brief.superficie_mq)) return false;
  }
  if (brief.obiettivo === 'conversion' && brief.lat !== '') {
    if (item.lat == null || item.lng == null) return false;
    const rad = n => n * Math.PI / 180;
    const h = Math.sin(rad(item.lat - Number(brief.lat))/2)**2 + Math.cos(rad(Number(brief.lat))) * Math.cos(rad(item.lat)) * Math.sin(rad(item.lng - Number(brief.lng))/2)**2;
    if (6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h))) > Number(brief.raggio_km)) return false;
  }
  return true;
}
export function SavedCampaignBrief({ brief, total }) {
  if (!brief) return null;
  return <div className="my-5 space-y-2"><p className="font-bold">Obiettivo: {OBJECTIVES.find(([key]) => key === brief.obiettivo)?.[1]}</p><BudgetSummary brief={brief} total={total} /><p className="text-xs text-slate-500">{brief.distribuzione === 'tutti' ? 'Presenza in tutti i comuni richiesti' : 'Migliore combinazione complessiva'}{brief.punto_vendita ? ` · Punto vendita: ${brief.punto_vendita}` : ''}</p></div>;
}
