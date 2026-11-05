export const stateCounts = (practices = []) => practices.reduce((counts, p) => ({ ...counts, [p.stato]: (counts[p.stato] || 0) + 1 }), {});
export function paymentLabel(practices = []) {
  if (!practices.length) return 'Non disponibile';
  const paid = practices.filter(p => p.pagata).length;
  if (paid === practices.length) return 'Pagata';
  if (paid) return `${paid}/${practices.length} pagate`;
  return practices.some(p => p.stato === 'APPROVATA') ? 'Da pagare' : 'Non richiesto';
}
export function groupMunicipalityCampaigns(practices) {
  const groups = new Map();
  for (const p of practices) {
    const id = p.campagna_id || `singola-${p.id}`;
    if (!groups.has(id)) groups.set(id, { id, nome: p.campagna_nome || p.spazio_nome || 'Richiesta singola', tipo: p.tipo, user_nome: p.user_nome, pratiche: [] });
    groups.get(id).pratiche.push(p);
  }
  return [...groups.values()].map(g => ({ ...g, per_stato: stateCounts(g.pratiche), data_inizio: g.pratiche.map(p => p.data_inizio).sort()[0], data_fine: g.pratiche.map(p => p.data_fine).sort().at(-1), importo: g.pratiche.reduce((s,p) => s + (p.importo || 0), 0) }));
}
