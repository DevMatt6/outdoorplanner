import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { api, apiError } from '../lib/api';
import { DynamicField, isVisible } from './DynamicField';
import { fieldErrors, groupByComune, initialShared, visibleDocuments } from '../lib/ospForms';

export function OSPFields({ fields, values, profile = {}, onChange, prefix = '' }) {
  const sections = {};
  fields.filter(f => isVisible(f, values)).forEach(f => { (sections[f.sezione || 'Dati della richiesta'] ||= []).push(f); });
  return Object.entries(sections).map(([name, rows]) => <section key={name} className="space-y-3">
    <h4 className="font-semibold text-sm">{name}</h4>
    <div className="grid sm:grid-cols-2 gap-4">{rows.map(f => f.profilo && profile[f.id]
      ? <div key={f.id} className="rounded-lg bg-muted p-3"><div className="text-xs text-muted-foreground">{f.label} · dal profilo</div><div className="text-sm mt-1 break-words">{profile[f.id]}</div></div>
      : <DynamicField key={f.id} campo={f} idPrefix={prefix} value={values[f.id]} onChange={v => onChange(f.id, v)} />)}</div>
  </section>);
}
export function OSPDocuments({ pratica, template, values, documents, onUploaded }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const upload = async (e, d) => {
    const file = e.target.files[0]; if (!file) return;
    setBusy(d.id); setError('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const { data } = await api.post(`/pratiche/${pratica.id}/documenti?tipo=${encodeURIComponent(d.id)}`, fd);
      onUploaded(data);
    } catch (err) { setError(apiError(err)); } finally { setBusy(''); e.target.value = ''; }
  };
  return <section className="space-y-3"><h4 className="font-semibold">Allegati · {pratica.spazio_nome}</h4>
    <p className="text-xs text-muted-foreground">Ogni file è associato solo a questa area. Carica gli allegati anche per le altre aree selezionate. PDF / P7M; per le fotografie anche JPG e PNG. Massimo 20 MB per file.</p>
    {visibleDocuments(template, values).map(d => <div key={d.id} className="border rounded-xl p-4 flex flex-wrap gap-3 items-center" data-testid={`doc-pratica-${pratica.id}-${d.id}`}>
      <div className="flex-1 min-w-[180px]"><div className="text-sm font-medium">{d.label}{d.required && <span className="text-destructive"> *</span>}</div>
        {d.help_text && <p className="text-xs text-muted-foreground mt-1">{d.help_text}</p>}
        {d.fonte_url && <a className="text-xs text-brand-foreground underline" href={d.fonte_url} target="_blank" rel="noreferrer">Modello ufficiale</a>}
        <div className="text-xs mt-1 text-muted-foreground">{documents.filter(x => x.tipo === d.id).map(x => x.nome).join(', ') || 'Nessun file caricato'}</div></div>
      <label className={`border rounded-md px-4 py-2 text-sm ${busy ? 'opacity-50' : 'cursor-pointer hover:border-primary'}`}>{busy === d.id ? 'Caricamento…' : documents.some(x => x.tipo === d.id) ? 'Sostituisci' : 'Carica'}<input aria-label={`${d.label} · ${pratica.spazio_nome}`} data-testid={`upload-pratica-${pratica.id}-${d.id}`} type="file" accept={d.accept} disabled={!!busy} className="hidden" onChange={e => upload(e, d)} /></label>
    </div>)}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
export const OSPForms = forwardRef(function OSPForms({ pratiche, campagnaId, comuneNome = id => id }, ref) {
  const [templates, setTemplates] = useState(null), [values, setValues] = useState({}), [shared, setShared] = useState({}), [docs, setDocs] = useState({});
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false);
  const key = pratiche.map(p => p.id).join(',');
  useEffect(() => {
    let active = true;
    setTemplates(null);
    Promise.all(pratiche.map(async p => [p.id, p.form_template_snapshot || (await api.get(`/form-templates/spazio/${p.spazio_id}`)).data])).then(entries => {
      if (!active) return;
      const t = Object.fromEntries(entries); setTemplates(t);
      setValues(Object.fromEntries(pratiche.map(p => [p.id, p.dati_form || {}])));
      setDocs(Object.fromEntries(pratiche.map(p => [p.id, p.documenti || []])));
      setShared(initialShared(pratiche, t));
    }).catch(e => { if (active) setError(apiError(e)); });
    return () => { active = false; };
    // Preserve unsaved edits when the parent refreshes payment status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const merged = p => ({ ...values[p.id], ...shared[p.comune_id] });
  const save = async (validate = false) => {
    if (!templates || busy) return false;
    setError(''); setSaved(false);
    if (validate) for (const p of pratiche) {
      const v = merged(p), missing = fieldErrors(templates[p.id], v);
      missing.push(...visibleDocuments(templates[p.id], v).filter(d => d.required && !(docs[p.id] || []).some(x => x.tipo === d.id)).map(d => `Allegato: ${d.label}`));
      if (missing.length) { setError(`${p.spazio_nome}: ${missing.join('; ')}`); return false; }
    }
    setBusy(true);
    try {
      for (const p of pratiche) {
        if (campagnaId) await api.put(`/campagne/${campagnaId}/dati-form`, { pratica_ids: [p.id], dati_form: merged(p) });
        else await api.put(`/pratiche/${p.id}`, { dati_form: merged(p) });
      }
      setSaved(true); return true;
    } catch (e) { setError(apiError(e)); return false; } finally { setBusy(false); }
  };
  useImperativeHandle(ref, () => ({ save }));
  if (!templates) return <div role="status">{error || 'Caricamento moduli…'}</div>;
  return <div className="space-y-6" data-testid="osp-forms">
    <div className="flex flex-wrap gap-3 justify-between items-start"><div><h2 className="font-semibold text-xl">Moduli OSP</h2><p className="text-sm text-muted-foreground mt-1">I dati condivisi si compilano una sola volta per Comune. Gli allegati restano separati per area.</p></div><button type="button" disabled={busy} onClick={() => save(false)} className="border rounded-md px-4 py-2 text-sm">{busy ? 'Salvataggio…' : 'Salva bozza'}</button></div>
    {groupByComune(pratiche).map(group => {
      const common = Array.from(new Map(group.pratiche.flatMap(p => (templates[p.id]?.campi || []).filter(f => f.scope === 'comune').map(f => [f.id, f]))).values());
      const first = group.pratiche[0], tpl = templates[first.id];
      return <section key={group.id} className="border rounded-xl overflow-hidden" data-testid={`osp-comune-${group.id}`}>
        <div className="bg-muted p-5"><h3 className="font-semibold">Comune di {comuneNome(group.id)}</h3><p className="text-xs text-muted-foreground mt-1">{group.pratiche.length} aree · {tpl?.nome}</p>{tpl?.fonte_url && <a className="text-xs underline text-brand-foreground" href={tpl.fonte_url} target="_blank" rel="noreferrer">Requisiti del modello ufficiale Roma Capitale</a>}</div>
        {common.length > 0 && <div className="p-5 space-y-6" data-testid={`osp-common-${group.id}`}><OSPFields fields={common} values={merged(first)} profile={first.richiedente} prefix={`${group.id}-`} onChange={(id, value) => { setSaved(false); setShared(prev => ({ ...prev, [group.id]: { ...prev[group.id], [id]: value } })); }} /></div>}
        {group.pratiche.map(p => <div className="border-t p-5 space-y-6" key={p.id} data-testid={`modulo-pratica-${p.id}`}><h3 className="font-semibold text-lg">{p.spazio_nome}</h3>
          <OSPFields fields={(templates[p.id]?.campi || []).filter(f => f.scope !== 'comune')} values={merged(p)} profile={p.richiedente} prefix={`${p.id}-`} onChange={(id, value) => { setSaved(false); setValues(prev => ({ ...prev, [p.id]: { ...prev[p.id], [id]: value } })); }} />
          <OSPDocuments pratica={p} template={templates[p.id]} values={merged(p)} documents={docs[p.id] || []} onUploaded={doc => setDocs(prev => ({ ...prev, [p.id]: [...(prev[p.id] || []).filter(d => d.tipo !== doc.tipo), doc] }))} />
        </div>)}
      </section>;
    })}
    {error && <p role="alert" className="border border-destructive/30 bg-destructive-muted rounded-xl p-4 text-sm text-destructive">{error}</p>}
    {saved && <p role="status" className="text-sm text-success">Dati salvati. Puoi riprendere la compilazione da questa campagna.</p>}
  </div>;
});
