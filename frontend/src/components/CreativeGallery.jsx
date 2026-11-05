import { useState } from 'react';
import { FileImage, FileText, Film, ZoomIn } from 'lucide-react';
import { imgSrc } from '../lib/api';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';

const isImage = url => /\.(jpg|jpeg|png|webp|gif)(?:[?#]|$)/i.test(url || '');
const isVideo = url => /\.mp4(?:[?#]|$)/i.test(url || '');
const isPdf = url => /\.pdf(?:[?#]|$)/i.test(url || '');
export const creativeLabel = subject => {
  const name = subject.nome || `Soggetto ${subject.ordine || 1}`;
  return subject.formato && !name.includes(subject.formato) ? `${name} — ${subject.formato}` : name;
};
function Thumbnail({ subject }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const Icon = isVideo(subject.file_url) ? Film : isPdf(subject.file_url) ? FileText : FileImage;
  return isImage(subject.file_url) && failedUrl !== subject.file_url
    ? <img src={imgSrc(subject.file_url)} alt="" loading="lazy" className="h-full w-full object-contain p-2" onError={() => setFailedUrl(subject.file_url)} />
    : <Icon size={32} className="text-brand-foreground" aria-hidden="true" />;
}
export function CreativeGallery({ subjects = [] }) {
  const [selected, setSelected] = useState(null);
  const [failedUrl, setFailedUrl] = useState(null);
  const unique = [...new Map(subjects.filter(s => s?.file_url).map(s => [s.id || s.file_url, s])).values()];
  if (!unique.length) return null;
  return <section className="overflow-hidden rounded-xl border bg-card" data-testid="creative-gallery">
    <h2 className="border-b bg-muted px-5 py-3 text-xs font-semibold">Creatività ({unique.length})</h2>
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
      {unique.map(s => <button type="button" key={s.id || s.file_url} onClick={() => setSelected(s)} aria-label={`Visualizza ${creativeLabel(s)}`} className="group overflow-hidden rounded-lg border text-left hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <span className="relative flex aspect-[4/3] items-center justify-center bg-muted/50"><Thumbnail subject={s} /><ZoomIn size={17} className="absolute bottom-2 right-2 rounded bg-card text-brand-foreground" aria-hidden="true" /></span>
        <span className="block px-3 py-2 text-xs font-semibold">{creativeLabel(s)}</span>
      </button>)}
    </div>
    {selected && <Dialog open onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto" data-testid="creative-preview">
      <DialogTitle>{creativeLabel(selected)}</DialogTitle>
      <DialogDescription>Anteprima della creatività assegnata agli impianti.</DialogDescription>
      {isImage(selected.file_url) && failedUrl !== selected.file_url ? <img src={imgSrc(selected.file_url)} alt={creativeLabel(selected)} className="max-h-[65vh] w-full rounded-lg object-contain" onError={() => setFailedUrl(selected.file_url)} />
        : isVideo(selected.file_url) ? <video src={imgSrc(selected.file_url)} controls className="max-h-[65vh] w-full rounded-lg" />
        : isPdf(selected.file_url) ? <iframe title={creativeLabel(selected)} src={imgSrc(selected.file_url)} className="h-[65vh] w-full rounded-lg border" />
        : <p className="text-sm text-muted-foreground">Anteprima non disponibile. Puoi aprire il file originale.</p>}
      <a href={imgSrc(selected.file_url)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-foreground underline">Apri file originale</a>
    </DialogContent></Dialog>}
  </section>;
}
