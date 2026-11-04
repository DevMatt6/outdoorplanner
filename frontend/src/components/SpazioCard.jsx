import { PhotoCredit } from "./PhotoCredit";
import { imgSrc } from "../lib/api";
import { MapPin, Check, ImageOff } from "lucide-react";

export const SpazioCard = ({ spazio: s, onClick, selected = false, selectable = false, imageAspect = "square", periodCost, recommended = false, showOSPDetails = false }) => (
  <div data-testid={`spazio-card-${s.id}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} aria-label={selectable ? `${selected ? "Rimuovi" : "Seleziona"} ${s.nome}` : s.nome} aria-pressed={selectable ? selected : undefined}
    onKeyDown={(e) => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}
    className={`cursor-pointer bg-card border rounded-xl overflow-hidden transition-colors group
      ${selected ? "border-primary ring-2 ring-primary/30" : "border-slate-100 hover:border-primary"}`}>
    <div className={`relative overflow-hidden bg-muted ${imageAspect === "landscape" ? "aspect-[4/3]" : "aspect-square"}`}>
      <span className="absolute inset-0 flex items-center justify-center text-muted-foreground" aria-hidden="true"><ImageOff size={28} strokeWidth={1.3} /></span>
      {s.foto_url && <img src={imgSrc(s.foto_url)} alt={s.nome} loading="lazy" className="relative w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
      {recommended && <span data-testid={`osp-recommended-${s.id}`} className="absolute left-2 top-2 rounded-md bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground">Consigliato nel budget</span>}
      {s.disponibile === false && (
        <span className="absolute top-2 left-2 text-[10px] font-semibold rounded-md bg-primary text-primary-foreground px-2.5 py-1">Occupato</span>
      )}
      {selectable && (
        <span className={`absolute top-2 right-2 w-7 h-7 rounded-full border-2 flex items-center justify-center
          ${selected ? "bg-primary border-primary text-primary-foreground" : "bg-card/90 border-slate-300 text-transparent"}`}>
          <Check size={15} />
        </span>
      )}
    </div>
    <PhotoCredit spazio={s} />
    <div className="p-4">
      <div className="text-[10px] font-semibold tracking-normal text-brand-foreground">{s.tipologia}</div>
      <h3 className="font-heading font-semibold leading-tight mt-0.5 group-hover:text-brand-foreground transition-colors">{s.nome}</h3>
      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
        <MapPin size={12} className="shrink-0" /> {s.citta ? `${s.citta} · ` : ""}{s.indirizzo}{s.zona ? ` · ${s.zona}` : ""}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold rounded-md bg-muted px-2.5 py-1 text-slate-600">{s.formato || s.dimensioni}</span>
        <span className="font-heading font-semibold text-lg">{s.canone_giornaliero} €<span className="text-xs font-normal text-slate-500">/g</span></span>
      </div>
      {showOSPDetails && <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>Superficie: {s.superficie_mq != null ? `${s.superficie_mq} m²` : "non indicata"}</span><span>Capienza: {s.capienza != null ? `${s.capienza} persone` : "non indicata"}</span></div>}
      {periodCost !== undefined && <div className="mt-3 border-t pt-3 text-sm"><span className="font-semibold">{periodCost.toFixed(2)} €</span><span className="ml-1 text-xs text-muted-foreground">per l’intero periodo</span></div>}
    </div>
  </div>
);
