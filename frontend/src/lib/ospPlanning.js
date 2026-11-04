// Work in cents, matching the server's rounding of the full-period rental cost.
export const ospCost = (space, days) => Math.round((Number(space.canone_giornaliero) * days + Number.EPSILON) * 100);
export const initialOSPBrief = () => ({ budget: "", persone_previste: "", distribuzione: "tutti" });
export function ospBudgetError(budget) {
  return Number.isFinite(Number(budget)) && Number(budget) >= 0.01 ? "" : "Inserisci un budget di almeno 0,01 €";
}
export function ospPeopleError(people) {
  return Number.isSafeInteger(Number(people)) && Number(people) > 0 ? "" : "Inserisci un numero intero di persone previste maggiore di zero";
}
export const ospBriefPayload = (brief, cities) => ({ budget: Number(brief.budget), persone_previste: Number(brief.persone_previste), distribuzione: brief.distribuzione, comuni_ids: cities });
export function ospAvailable(spaces, cities, days, people = 0) {
  return spaces.filter((s) => cities.includes(s.comune_id) && (!people || (Number.isInteger(s.capienza) && s.capienza >= people)) && s.attivo !== false && s.disponibile !== false && !s.occupato && days >= (s.giorni_minimi || 1) && Number.isFinite(Number(s.canone_giornaliero)) && Number(s.canone_giornaliero) >= 0);
}
export function ospBudgetAdvice(spaces, selectedIds, cities, budget, days) {
  const chosen = new Set(selectedIds);
  const selected = spaces.filter((s) => chosen.has(s.id));
  const total = selected.reduce((sum, s) => sum + ospCost(s, days), 0);
  const remaining = Math.round(Number(budget) * 100) - total;
  const covered = new Set(selected.map((s) => s.comune_id));
  const missing = cities.filter((id) => !covered.has(id));
  const minimums = new Map(missing.map((id) => [id, Math.min(...spaces.filter((s) => s.comune_id === id).map((s) => ospCost(s, days)))]));
  const recommended = new Set(spaces.filter((s) => {
    if (chosen.has(s.id)) return false;
    const reserve = missing.filter((id) => id !== s.comune_id).reduce((sum, id) => sum + minimums.get(id), 0);
    return ospCost(s, days) + reserve <= remaining;
  }).map((s) => s.id));
  const minimumRequired = missing.reduce((sum, id) => sum + minimums.get(id), 0);
  return { recommended, total, remaining, feasible: minimumRequired <= remaining };
}
