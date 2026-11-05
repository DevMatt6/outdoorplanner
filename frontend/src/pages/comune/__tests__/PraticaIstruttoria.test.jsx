import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import PraticaIstruttoria from '../PraticaIstruttoria';
import { api } from '../../../lib/api';
import { useAuth } from '../../../store/auth';
jest.mock('../../../store/auth',()=>({useAuth:jest.fn()}));
jest.mock('react-router-dom',()=>({useParams:()=>({id:'p'}),Link:({children})=><span>{children}</span>}),{virtual:true});
jest.mock('../../../components/BackofficeLayout',()=>({BackofficeLayout:({children})=><div>{children}</div>}));
jest.mock('../../../components/ChatFloating',()=>({ChatFloating:()=>null}));
jest.mock('../../../components/PraticaDettagli',()=>({SezioneRichiedente:()=>null,SezionePrenotazione:()=>null,SezioneImpiantiCreativita:()=>null,SezioneDatiForm:()=>null,SezioneDocumenti:()=>null}));
jest.mock('../../../lib/api',()=>({api:{get:jest.fn(),post:jest.fn()},apiError:String}));
jest.mock('sonner',()=>({toast:{success:jest.fn(),error:jest.fn()}}));
global.IS_REACT_ACT_ENVIRONMENT=true;
test.each([['OOH',1,true],['OOH',2,true],['OOH',3,true],['OSP',1,false],['OSP',2,false],['OSP',3,true]])('%s level %s approval availability',async(tipo,livello,allowed)=>{
 useAuth.mockReturnValue({user:{livello}});
 api.get.mockResolvedValue({data:{id:'p',tipo,stato:tipo==='OOH'?'IN_VERIFICA':'IN_ISTRUTTORIA',spazio_nome:'Old circuit name',zona_nome:'Centro',comune:{nome:'Roma',livelli_attivi:[1,2,3]},importo:10,log_stato:[],impianti:[],documenti:[],template:{campi:[]}}});
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<PraticaIstruttoria/>));
  expect(!!host.querySelector('[data-testid="btn-approva"]')).toBe(allowed);
  if(tipo==='OOH'){
   expect(host.querySelector('[data-testid="btn-rifiuta"]')).not.toBeNull();
   expect(host.querySelector('[data-testid="btn-integrazione"]')).not.toBeNull();
   expect(host.querySelector('[data-testid="fase-approvativa"]')).toBeNull();
   expect(host.querySelector('h1').textContent).toBe('Roma · Centro');
  }
 }finally{act(()=>root.unmount());host.remove();}
});
