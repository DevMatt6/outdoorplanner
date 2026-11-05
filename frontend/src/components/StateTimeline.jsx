import { ArrowRight, History } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

export function StateTimeline({ entries = [] }) {
  return <section className="mt-6 overflow-hidden rounded-xl border bg-card" aria-label="Cronologia degli stati" data-testid="state-timeline">
    <div className="flex items-center gap-4 overflow-x-auto p-4" tabIndex={0} aria-label="Cronologia orizzontale, scorri per vedere tutti gli stati">
      <h2 className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold"><History size={16} className="text-brand-foreground" />Log stati</h2>
      {!entries.length ? <p className="text-sm text-muted-foreground">Nessun cambio di stato registrato.</p> : <ol className="flex flex-nowrap items-center gap-4">
        {entries.map((entry, index) => <li key={entry.id || index} className="flex shrink-0 items-center gap-3 whitespace-nowrap text-xs">
          {index > 0 && <ArrowRight size={15} className="text-muted-foreground" aria-hidden="true" />}
          <StatusBadge stato={entry.a} />
          {entry.timestamp && <time dateTime={entry.timestamp} className="tabular-nums text-muted-foreground">{new Date(entry.timestamp).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</time>}
          {entry.autore_nome && <span className="font-medium">{entry.autore_nome}</span>}
          {entry.nota && <span className="text-muted-foreground">{entry.nota}</span>}
        </li>)}
      </ol>}
    </div>
  </section>;
}
