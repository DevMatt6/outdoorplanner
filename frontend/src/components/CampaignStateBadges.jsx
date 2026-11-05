import { StatusBadge, STATO_COLORS } from './StatusBadge';
export const campaignStateText = counts => Object.keys(counts || {}).map(s => STATO_COLORS[s]?.label || s).join(' ');
export function CampaignStateBadges({ counts }) {
  return <div className="flex flex-wrap items-center gap-2">{Object.entries(counts || {}).map(([state, count]) => <span key={state} className="inline-flex items-center gap-1"><span className="text-xs text-muted-foreground">{count} ×</span><StatusBadge stato={state} /></span>)}</div>;
}
