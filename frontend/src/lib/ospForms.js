export function matches(rule, values) {
  if (!rule) return true;
  if (rule.tutte) return rule.tutte.every(r => matches(r, values));
  if (rule.almeno_una) return rule.almeno_una.some(r => matches(r, values));
  if (rule.op === 'ne') return values[rule.campo] !== rule.valore;
  if (rule.op === 'in') return rule.valore.includes(values[rule.campo]);
  return values[rule.campo] === rule.valore;
}
export const visibleDocuments = (tpl, values) => (tpl?.documenti_richiesti || []).filter(d => matches(d.condizione, values));
export function fieldErrors(tpl, values) {
  const errors = [];
  (tpl?.campi || []).filter(f => matches(f.condizione, values)).forEach(f => {
    const v = values[f.id], empty = v === undefined || v === null || (typeof v === 'string' && !v.trim());
    if (f.required && (empty || (f.tipo === 'checkbox' && v !== true))) errors.push(f.label);
    else if (!empty && f.tipo === 'number' && (!Number.isFinite(Number(v)) || (f.min != null && Number(v) < f.min) || (f.intero && !Number.isInteger(Number(v))))) errors.push(`${f.label}: valore non valido`);
    else if (!empty && f.tipo === 'select' && !f.opzioni.includes(v)) errors.push(`${f.label}: scelta non valida`);
  });
  if (tpl?.schema_key) {
    if (Number(values.superficie_culturale || 0) + Number(values.superficie_commerciale || 0) > Number(values.superficie_totale || 0)) errors.push('Le quote di superficie superano il totale');
    if (values.elaborato_semplificato && (new Date(values.data_fine) - new Date(values.data_inizio)) / 86400000 > 2) errors.push('Elaborato semplificato ammesso solo fino a 3 giorni');
  }
  return errors;
}
export function groupByComune(pratiche) {
  return Object.values(pratiche.reduce((groups, p) => {
    (groups[p.comune_id] ||= { id: p.comune_id, pratiche: [] }).pratiche.push(p);
    return groups;
  }, {}));
}
export function initialShared(pratiche, templates) {
  const groups = {};
  pratiche.forEach(p => {
    groups[p.comune_id] ||= {};
    (templates[p.id]?.campi || []).filter(f => f.scope === 'comune').forEach(f => {
      if (!(f.id in groups[p.comune_id]) && p.dati_form?.[f.id] !== undefined) groups[p.comune_id][f.id] = p.dati_form[f.id];
    });
  });
  return groups;
}
