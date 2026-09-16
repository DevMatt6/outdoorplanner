import { Calendar } from "./ui/calendar";
import { it } from "date-fns/locale";
import { format } from "date-fns";

const toDate = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const fmtDay = (d) => (d ? format(d, "yyyy-MM-dd") : "");

export const DateRangePicker = ({ occupazioni = [], value, onChange, months = 2 }) => {
  const occupiedRanges = occupazioni.map((o) => ({ from: toDate(o.data_inizio), to: toDate(o.data_fine) }));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleSelect = (r) => {
    if (r?.from && r?.to) {
      const crosses = occupiedRanges.some((o) => o.from <= r.to && o.to >= r.from);
      if (crosses) {
        onChange({ from: r.to > (value?.from || 0) ? r.to : r.from, to: undefined });
        return;
      }
    }
    onChange(r);
  };

  return (
    <div data-testid="date-range-picker">
      <Calendar
        mode="range"
        numberOfMonths={months}
        locale={it}
        selected={value}
        onSelect={onChange}
        disabled={[{ before: today }, ...occupiedRanges]}
        modifiers={{ occupato: occupiedRanges }}
        modifiersClassNames={{ occupato: "!bg-red-50 !text-red-300 line-through" }}
        classNames={{
          months: "flex flex-col sm:flex-row w-full gap-8",
          month: "flex-1 space-y-4 min-w-0",
          table: "w-full border-collapse",
          head_row: "flex w-full",
          head_cell: "flex-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center",
          row: "flex w-full mt-1",
          cell: "flex-1 text-center text-sm p-0 relative",
          day: "h-10 w-full p-0 font-normal rounded-lg hover:bg-[#F0F4FF] transition-colors aria-selected:opacity-100",
          day_selected: "!bg-[#1F3BB3] !text-white hover:!bg-[#1F3BB3]",
          day_range_middle: "!bg-[#E8EFFF] !text-[#1F3BB3] !rounded-none",
          day_today: "bg-[#E8EFFF] text-[#1F3BB3] font-bold",
        }}
        className="rounded-2xl border border-slate-100 bg-white w-full p-5"
      />
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#1F3BB3]" /> Periodo selezionato</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-100" /> Date già occupate</span>
        {value?.from && (
          <span className="ml-auto font-mono text-slate-700 bg-[#F8F9FD] rounded-full px-3 py-1" data-testid="range-summary">
            {fmtDay(value.from)} → {value.to ? fmtDay(value.to) : "..."}
          </span>
        )}
      </div>
    </div>
  );
};
