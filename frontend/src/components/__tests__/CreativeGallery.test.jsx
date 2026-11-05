import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {SezioneImpiantiCreativita} from '../PraticaDettagli';
jest.mock('../../lib/api',()=>({imgSrc:url=>url}));
global.IS_REACT_ACT_ENVIRONMENT=true;
test('shows assignment labels only, deduplicates creative previews and opens/closes the image modal',async()=>{
 const subject={id:'s',nome:'Soggetto 1 — 70x100 cm',formato:'70x100 cm',file_url:'/api/uploads/creativita/example.png',file_nome:'example.png'};
 const practice={impianti:[{id:'a',codice:'A',formato:'70x100 cm'},{id:'b',codice:'B',formato:'70x100 cm'}],zona_nome:'Centro',creativita_dettagli:[{impianto_id:'a',soggetto:subject},{impianto_id:'b',soggetto:subject}]};
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<SezioneImpiantiCreativita pratica={practice}/>));
  const row=host.querySelector('[data-testid="impianto-row-A"]');
  expect(row.textContent).toContain('Creatività: Soggetto 1 — 70x100 cm');
  expect(row.querySelector('a')).toBeNull();
  const gallery=host.querySelector('[data-testid="creative-gallery"]');
  expect(gallery.querySelectorAll('button').length).toBe(1);
  await act(async()=>gallery.querySelector('button').click());
  const preview=document.querySelector('[data-testid="creative-preview"]');
  expect(preview.querySelector('img').getAttribute('src')).toBe(subject.file_url);
  expect(preview.textContent).toContain('Soggetto 1 — 70x100 cm');
  await act(async()=>[...preview.querySelectorAll('button')].find(b=>b.textContent==='Chiudi').click());
  expect(document.querySelector('[data-testid="creative-preview"]')).toBeNull();
 }finally{act(()=>root.unmount());host.remove();}
});
