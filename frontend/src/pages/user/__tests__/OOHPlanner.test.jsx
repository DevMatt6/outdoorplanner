import React, { act } from "react";
import { createRoot } from "react-dom/client";
import OOHPlanner from "../OOHPlanner";
import { api } from "../../../lib/api";
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock("../../../components/BackofficeLayout", () => ({ UserShell: ({ children }) => <div>{children}</div> }));
jest.mock("../../../components/DateRangePicker", () => ({ DateRangePicker: ({onChange}) => <button onClick={() => onChange({from:new Date(2027,0,1),to:new Date(2027,0,2)})}>Periodo test</button>, fmtDay: (date) => date ? '2027-01-01' : '' }));
jest.mock("../../../components/CampaignBrief", () => ({ initialBrief: { budget:1000, distribuzione:'tutti' }, briefPayload: (b) => b, briefError: () => null, catalogCompatible: () => true, CampaignBrief: () => <div>Brief</div>, BudgetSummary: () => null, RecommendationPanel: ({children,onApply}) => <div>{children}<button onClick={onApply}>Ripristina proposta</button></div> }));
jest.mock("../../../lib/api", () => ({ api: {get:jest.fn(),post:jest.fn()}, apiError:String, imgSrc: x => x }));
jest.mock("sonner", () => ({toast:{success:jest.fn()}}));
jest.mock("react-leaflet", () => ({MapContainer: ({children}) => <div>{children}</div>,TileLayer: () => null,Polygon: ({children}) => <div>{children}</div>,CircleMarker: ({children,pathOptions}) => <div data-color={pathOptions.fillColor}>{children}</div>,Tooltip: ({children}) => <div>{children}</div>,Marker: ({children,icon}) => <div data-cluster={icon.options.html}>{children}</div>,Polyline: ({positions}) => <div data-line={JSON.stringify(positions)} />,useMapEvents: () => mockMap}), {virtual:true});
const mockMap={getZoom:()=>14};
global.IS_REACT_ACT_ENVIRONMENT=true;
test('one proposal/circuit step preselects suggestions, supports manual additions and goes straight to summary',async()=>{
 const points=[{id:'a',codice:'A',lat:41.9,lng:12.5,prezzo:10,tipologia:'Poster'},{id:'b',codice:'B',lat:41.91,lng:12.51,prezzo:10,tipologia:'Poster'}];
 const circuit={id:'pac',comune_id:'rome',zona_id:'z',nome:'Centro',disponibile:true,impianti:points,n_impianti:2,impianti_liberi:2,prezzo_giornaliero:20};
 api.get.mockImplementation(path=>Promise.resolve({data:path==='/comuni'?[{id:'rome',nome:'Roma',logo_url:'/api/uploads/roma.png',regione:'Lazio',lat:41.9,lng:12.5}]:path.startsWith('/ooh/zone')?[{id:'z',nome:'Zona centro',polygon:[[41.9,12.5],[41.91,12.51],[41.92,12.5]],impianti_count:2}]:[circuit]}));
 api.post.mockResolvedValue({data:{items:[{...points[0],pacchetto_id:'pac',comune_id:'rome'}],avvisi:[],fattibile:true}});
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 const click=async(node)=>{await act(async()=>node.click());};const button=(text)=>[...host.querySelectorAll('button')].find(b=>b.textContent===text);const byTest=id=>host.querySelector(`[data-testid="${id}"]`);
 try{
  await act(async()=>root.render(<OOHPlanner/>));
  await click(byTest('ooh-next-button'));
  const input=byTest('ooh-nome-input');await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Test');input.dispatchEvent(new Event('input',{bubbles:true}));});
  await click(button('Periodo test'));await click(byTest('ooh-next-button'));
  await click(byTest('ooh-regione-Lazio'));expect(byTest('ooh-comune-rome').querySelector('img').getAttribute('src')).toBe('/api/uploads/roma.png');await click(byTest('ooh-comune-rome'));await click(byTest('ooh-next-button'));
  expect(byTest('ooh-pacchetto-pac').textContent).toContain('1/2 impianti scelti');
  expect(byTest('ooh-zona-z').textContent).toContain('1 impianti scelti');
  expect(host.querySelectorAll('[data-color="#93A6E8"]').length).toBe(1);
  await click(byTest('ooh-impianti-pac'));await click(byTest('ooh-imp-check-b').querySelector('input'));
  expect(byTest('ooh-zona-z').textContent).toContain('2 impianti scelti');
  await click(byTest('ooh-next-button'));
  expect(byTest('ooh-riepilogo-totale')).not.toBeNull();expect(byTest('ooh-next-button').textContent).toBe('Genera Campagna');
 }finally{act(()=>root.unmount());host.remove();}
});
