import { matches } from '../lib/ospForms';
export const DynamicField = ({ campo, value, onChange, idPrefix = '' }) => {
  const base = 'w-full border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary transition-colors bg-card';
  const tid = `field-${campo.id}`, id = `${idPrefix}${tid}`;
  const props = { id, 'aria-required': campo.required || undefined, 'data-testid': tid, disabled: campo.read_only, 'aria-describedby': campo.help_text ? `${id}-help` : undefined };
  return <div>
    <label htmlFor={id} className="block text-xs font-semibold text-muted-foreground mb-1.5">{campo.label} {campo.required && <span className="text-destructive">*</span>}</label>
    {campo.tipo === 'textarea' ? <textarea {...props} rows={3} className={base} value={value ?? ''} onChange={e => onChange(e.target.value)} />
      : campo.tipo === 'select' ? <select {...props} className={base} value={value ?? ''} onChange={e => onChange(e.target.value)}><option value="">— Seleziona —</option>{(campo.opzioni || []).map(o => <option key={o} value={o}>{o}</option>)}</select>
      : campo.tipo === 'checkbox' ? <label className="flex items-center gap-2 border border-border rounded-xl px-3 py-2.5 cursor-pointer"><input {...props} type="checkbox" checked={value === true} onChange={e => onChange(e.target.checked)} className="w-4 h-4 accent-primary" /><span className="text-sm">Confermo</span></label>
      : <input {...props} type={['number','date','email','time'].includes(campo.tipo) ? campo.tipo : 'text'} min={campo.min} max={campo.max} step={campo.tipo === 'number' ? (campo.intero ? 1 : 'any') : undefined} className={base} value={value ?? ''} onChange={e => onChange(e.target.value)} />}
    {campo.help_text && <p id={`${id}-help`} className="mt-1.5 text-xs text-muted-foreground">{campo.help_text}</p>}
  </div>;
};
export const isVisible = (campo, values) => matches(campo.condizione, values);
