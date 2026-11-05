import { practiceLabel } from "../lib/practicePresentation";
import { Link } from "react-router-dom";
import { ArrowRight, Trash2 } from "lucide-react";
import { DataTable } from "./DataTable";
import { StatusBadge, STATO_COLORS, TipoBadge } from "./StatusBadge";

const comuneName = (p) => p.comune_nome || p.citta || "Non disponibile";
const columns = [
  { label: "Spazio / Zona", key: "spazio_nome", value: practiceLabel },
  { label: "Comune / Città", key: "comune_nome", value: comuneName },
  { label: "Tipo", key: "tipo", value: (p) => p.tipo === "OOH" ? "Campagna OOH" : "OSP / Evento" },
  { label: "Dal", key: "data_inizio" },
  { label: "Al", key: "data_fine" },
  { label: "Importo", key: "importo" },
  { label: "Stato", key: "stato", value: (p) => STATO_COLORS[p.stato]?.label || p.stato },
  { label: "Azioni" },
];

export function PraticheTable({ pratiche, onDelete, rowTestPrefix = "pratica-row" }) {
  return <DataTable data={pratiche} columns={columns} label="Cerca per spazio, Comune o stato…" renderRow={(p) => <tr key={p.id} data-testid={`${rowTestPrefix}-${p.id}`} className="border-b hover:bg-accent/50 transition-colors">
    <td className="px-4 py-3"><Link to={`/pratiche/${p.id}`} className="font-medium hover:text-brand-foreground hover:underline">{practiceLabel(p)}</Link></td>
    <td className="px-4 py-3" data-testid={`pratica-comune-${p.id}`}>{comuneName(p)}</td>
    <td className="px-4 py-3"><TipoBadge tipo={p.tipo} /></td>
    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{p.data_inizio}</td>
    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{p.data_fine}</td>
    <td className="whitespace-nowrap px-4 py-3 tabular-nums font-medium">{Number(p.importo || 0).toFixed(2)} €</td>
    <td className="px-4 py-3"><StatusBadge stato={p.stato} /></td>
    <td className="px-4 py-3"><div className="flex items-center gap-2"><Link to={`/pratiche/${p.id}`} aria-label={`Apri pratica ${practiceLabel(p)}`} title="Apri pratica" className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent"><ArrowRight size={14} /></Link>{onDelete && p.stato === "BOZZA" && <button data-testid={`delete-pratica-${p.id}`} onClick={(e) => onDelete(e, p.id)} aria-label={`Elimina bozza ${practiceLabel(p)}`} title="Elimina bozza" className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:border-destructive hover:text-destructive"><Trash2 size={14} /></button>}</div></td>
  </tr>} />;
}
