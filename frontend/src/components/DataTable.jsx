import { useMemo, useState } from "react";
import { Search, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead } from "./ui/table";
import { EmptyState } from "./DashboardUI";

// Rows remain owned by each page so their actions and permissions stay unchanged.
export function DataTable({ data, columns, renderRow, label = "Cerca…", pageSize = 10 }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: null, direction: 1 });
  const [page, setPage] = useState(0);
  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("it");
    const result = data.filter((row) => !needle || columns.some((col) => col.key && String((col.value ? col.value(row) : row[col.key]) ?? "").toLocaleLowerCase("it").includes(needle)));
    if (sort.key) result.sort((a, b) => {
      const col = columns.find((item) => item.key === sort.key);
      const av = (col?.value ? col.value(a) : a[sort.key]) ?? "", bv = (col?.value ? col.value(b) : b[sort.key]) ?? "";
      return sort.direction * (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "it", { numeric: true }));
    });
    return result;
  }, [data, columns, query, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div className="relative w-full sm:w-72"><Search size={15} className="pointer-events-none absolute left-3 top-3 text-muted-foreground" /><Input aria-label={label} placeholder={label} value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} className="pl-9" /></div><span className="text-xs text-muted-foreground" aria-live="polite">{rows.length} risultati</span></div>
    <Table><TableHeader><TableRow>{columns.map(({ label, key }) => <TableHead key={label} className="px-4 py-2" aria-sort={sort.key === key && key ? sort.direction === 1 ? "ascending" : "descending" : undefined}>{key ? <button className="inline-flex min-h-8 items-center gap-2 text-xs" onClick={() => { setSort({ key, direction: sort.key === key ? -sort.direction : 1 }); setPage(0); }}>{label}{sort.key === key ? sort.direction === 1 ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : <ArrowUpDown size={13} className="opacity-50" />}</button> : label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(current * pageSize, (current + 1) * pageSize).map(renderRow)}</TableBody></Table>
    {rows.length === 0 && <EmptyState title="Nessun risultato" description={query ? "Prova a modificare la ricerca o i filtri." : "I dati saranno visibili qui quando disponibili."} />}
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3"><span className="text-xs text-muted-foreground">Pagina {current + 1} di {pages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={current === 0} aria-label="Pagina precedente" onClick={() => setPage(current - 1)}><ChevronLeft /><span className="hidden sm:inline">Precedente</span></Button><Button variant="outline" size="sm" disabled={current + 1 >= pages} aria-label="Pagina successiva" onClick={() => setPage(current + 1)}><span className="hidden sm:inline">Successiva</span><ChevronRight /></Button></div></div>
  </div>;
}
