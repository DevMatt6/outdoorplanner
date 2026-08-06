import { imgSrc } from "../lib/api";
import { MapPin, Check } from "lucide-react";

export const SpazioCard = ({ spazio: s, onClick, selected = false, selectable = false }) => (
  <div data-testid={`spazio-card-${s.id}`} onClick={onClick}
    className={`cursor-pointer bg-white border rounded-2xl overflow-hidden transition-colors group
      ${selected ? "border-[#2F5B41] ring-2 ring-[#2F5B41]/30" : "border-slate-100 hover:border-[#2F5B41]"}`}>
    <div className="relative aspect-[4/3] overflow-hidden bg-[#F5F6F3]">
      <img src={imgSrc(s.foto_url)} alt={s.nome} className="w-full h-full object-cover" />
      {s.disponibile === false && (
        <span className="absolute top-2 left-2 text-[10px] font-bold rounded-full bg-[#26292B] text-white px-2.5 py-1">Occupato</span>
      )}
      {selectable && (
        <span className={`absolute top-2 right-2 w-7 h-7 rounded-full border-2 flex items-center justify-center
          ${selected ? "bg-[#2F5B41] border-[#2F5B41] text-white" : "bg-white/90 border-slate-300 text-transparent"}`}>
          <Check size={15} />
        </span>
      )}
    </div>
    <div className="p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2F5B41]">{s.tipologia}</div>
      <h3 className="font-heading font-extrabold leading-tight mt-0.5 group-hover:text-[#1F3D2B] transition-colors">{s.nome}</h3>
      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
        <MapPin size={12} className="shrink-0" /> {s.indirizzo}{s.zona ? ` · ${s.zona}` : ""}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] font-bold rounded-full bg-[#F5F6F3] px-2.5 py-1 text-slate-600">{s.formato || s.dimensioni}</span>
        <span className="font-heading font-extrabold text-lg">{s.canone_giornaliero} €<span className="text-xs font-normal text-slate-500">/g</span></span>
      </div>
    </div>
  </div>
);
