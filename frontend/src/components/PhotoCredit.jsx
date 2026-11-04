export function PhotoCredit({ spazio }) {
  if (!spazio.foto_fonte_url || !spazio.foto_autore) return null;
  const stop = (e) => e.stopPropagation();
  return <div className="border-t bg-muted/30 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground" onClick={stop} onKeyDown={stop}>
    Foto: <a href={spazio.foto_fonte_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{spazio.foto_autore}</a>
    {spazio.foto_licenza_url && <> · <a href={spazio.foto_licenza_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{spazio.foto_licenza}</a></>}
    <span className="ml-1">· ritaglio di visualizzazione</span>
  </div>;
}
