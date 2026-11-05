import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import Scrivania from '../Scrivania';
import {api} from '../../../lib/api';
jest.mock('react-router-dom',()=>({Link:({to,children,...props})=><a href={to} {...props}>{children}</a>}),{virtual:true});
jest.mock('../../../components/BackofficeLayout',()=>({BackofficeLayout:({children})=><div>{children}</div>}));
jest.mock('../../../lib/api',()=>({api:{get:jest.fn()}}));
global.IS_REACT_ACT_ENVIRONMENT=true;
test('one campaign row summarizes all practices and opens a searchable detail table',async()=>{
 api.get.mockResolvedValue({data:['a','b'].map((id,index)=>({id,tipo:'OOH',campagna_id:'c',campagna_nome:'ProvaCampagna',user_nome:'Demo',stato:index?'APPROVATA':'INVIATA',importo:10,data_inizio:'2026-11-05',data_fine:'2026-11-22',zona_nome:id}))});
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<Scrivania/>));
  expect(host.querySelectorAll('tbody tr').length).toBe(1);
  expect(host.querySelector('tbody').textContent).toContain('ProvaCampagna');
  expect(host.querySelector('[data-testid="istruttoria-link-a"]')).toBeNull();
  await act(async()=>host.querySelector('[data-testid="coda-INVIATA"]').click());
  await act(async()=>host.querySelector('[data-testid="dettaglio-campagna-c"]').click());
  expect(host.querySelectorAll('tbody tr').length).toBe(2);
  expect(host.querySelector('[data-testid="istruttoria-link-a"]').getAttribute('href')).toBe('/comune/pratiche/a');
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Tutte le campagne').click());
  expect(host.querySelector('[data-testid="comune-campagne-table"]')).not.toBeNull();
 }finally{act(()=>root.unmount());host.remove();}
});
