import { useState } from "react";
import { api, apiError, imgSrc } from "../lib/api";

export function attachmentHref(url) {
  if (!url) return null;
  if (url.startsWith('/api/uploads/')) return imgSrc(url);
  try { const parsed = new URL(url); return ['http:', 'https:'].includes(parsed.protocol) ? url : null; } catch { return null; }
}
export function AttachmentLink({ field, label = 'Scarica modello' }) {
  const href = attachmentHref(field?.fonte_url);
  return href ? <a href={href} target="_blank" rel="noreferrer" className="inline-block text-xs text-brand-foreground underline">{label}{field.fonte_nome ? ` · ${field.fonte_nome}` : ''}</a> : null;
}
export function TemplateAttachmentEditor({ value, onChange, label, disabled, onBusyChange }) {
  const [error, setError] = useState('');
  const upload = async (event) => {
    const input = event.target, file = input.files[0]; if (!file) return;
    setError(''); onBusyChange(true);
    try {
      const body = new FormData(); body.append('file', file);
      const { data } = await api.post('/comune/form-templates/upload-allegato', body);
      onChange({ fonte_url: data.url, fonte_nome: data.nome });
    } catch (e) { setError(apiError(e)); }
    finally { input.value = ''; onBusyChange(false); }
  };
  return <div className="w-full space-y-2 rounded-lg bg-muted/50 p-3">
    <div className="text-xs font-medium">Modello da scaricare (facoltativo)</div>
    <div className="flex flex-wrap items-center gap-3">
      <input type="url" aria-label={`Link modello ${label}`} disabled={disabled} value={value.fonte_url || ''} placeholder="https://… oppure carica un file" className="min-w-0 flex-1 rounded-md border bg-card px-3 py-2 text-sm" onChange={e => onChange({ fonte_url: e.target.value, fonte_nome: '' })} />
      <label className={`rounded-md border bg-card px-3 py-2 text-xs font-semibold ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>Carica / sostituisci file<input type="file" aria-label={`Carica modello ${label}`} accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.png,.jpg,.jpeg,.p7m" disabled={disabled} className="hidden" onChange={upload} /></label>
      {value.fonte_url && <button type="button" disabled={disabled} onClick={() => onChange({ fonte_url: '', fonte_nome: '' })} className="text-xs text-destructive">Rimuovi modello</button>}
      <AttachmentLink field={value} label="Apri modello" />
    </div>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}
