export function practiceLabel(practice) {
  if (practice.tipo !== 'OOH') return practice.spazio_nome;
  const city = practice.comune_nome || practice.comune?.nome || 'Campagna OOH';
  return [city, practice.zona_nome].filter(Boolean).join(' · ');
}
export function installationGroups(practice) {
  const groups = new Map();
  for (const item of practice.impianti || []) {
    const circuit = (practice.circuiti || []).find(c => (c.impianti_ids || []).includes(item.id));
    const zone = item.zona_nome || circuit?.zona_nome || practice.zona_nome || 'Impianti selezionati';
    if (!groups.has(zone)) groups.set(zone, []);
    groups.get(zone).push({ ...item, circuito_nome: item.circuito_nome || circuit?.nome || practice.pacchetto_nome || '' });
  }
  return [...groups].map(([zona, impianti]) => ({ zona, impianti }));
}
