import { useState } from "react";
import { Landmark } from "lucide-react";
import { imgSrc } from "../lib/api";

export function ComuneLogo({ comune, className = "h-20 w-20" }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const url = comune?.logo_url;
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white p-1.5 ${className}`}>
    {url && failedUrl !== url ? <img src={imgSrc(url)} alt={`Logo Comune di ${comune?.nome || ""}`} className="h-full w-full object-contain" onError={() => setFailedUrl(url)} /> : <Landmark className="h-1/2 w-1/2 text-slate-400" aria-hidden="true" />}
  </span>;
}
