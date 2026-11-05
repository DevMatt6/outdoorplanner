import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import PraticaDetail from '../PraticaDetail';
import PraticaIstruttoria from '../../comune/PraticaIstruttoria';
import {api} from '../../../lib/api';
jest.mock('react-router-dom',()=>({useParams:()=>({id:'p'}),Link:({children})=><span>{children}</span>}),{virtual:true});
jest.mock('../../../components/BackofficeLayout',()=>({UserShell:({children})=><div>{children}</div>,BackofficeLayout:({children})=><div>{children}</div>}));
jest.mock('../../../store/auth',()=>({useAuth:()=>({user:{livello:3}})}));
jest.mock('../../../components/ChatFloating',()=>({ChatFloating:()=>null}));
jest.mock('../../../lib/api',()=>({api:{get:jest.fn()},apiError:String,imgSrc:x=>x}));
global.IS_REACT_ACT_ENVIRONMENT=true;
test.each([false,true])('paid=%s controls PDF access for both user and municipality',async(pagata)=>{
 api.get.mockResolvedValue({data:{id:'p',tipo:'OOH',stato:'APPROVATA',pagata,importo:10,comune:{nome:'Roma'},zona_nome:'Centro',documenti:[],impianti:[],log_stato:[]}});
 for(const Page of [PraticaDetail,PraticaIstruttoria]){
  const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
  try{
   await act(async()=>root.render(<Page/>));
   expect(!!host.querySelector('[data-testid="download-pdf-button"], [data-testid="btn-pdf-comune"]')).toBe(pagata);
   if(!pagata)expect(host.textContent).toContain('PDF sarà disponibile dopo il pagamento');
  }finally{act(()=>root.unmount());host.remove();}
 }
});
