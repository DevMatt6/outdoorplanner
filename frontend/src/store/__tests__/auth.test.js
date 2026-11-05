function storage() {
 const rows = new Map();
 return { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, String(value)), removeItem: key => rows.delete(key) };
}
const originalSessionStorage = window.sessionStorage;
const activate = tab => Object.defineProperty(window, 'sessionStorage', { configurable:true, value:tab.storage });
function openTab(existingStorage = storage()) {
 const tab = { storage:existingStorage };
 activate(tab);
 jest.isolateModules(() => { tab.auth = require('../auth').useAuth; tab.api = require('../../lib/api').api; });
 return tab;
}
afterEach(() => { Object.defineProperty(window,'sessionStorage',{configurable:true,value:originalSessionStorage}); localStorage.clear(); });
test('three roles retain independent sessions and API tokens after reload and logout in another tab',()=>{
 localStorage.setItem('op_token','legacy-shared-token');localStorage.setItem('op_user',JSON.stringify({ruolo:'user'}));
 const tabs = ['comune','superadmin','user'].map(role => {
  const tab=openTab();
  expect(tab.auth.getState().user).toBeNull();
  tab.auth.getState().setSession({id:role,ruolo:role},'token-'+role);
  return tab;
 });
 expect(localStorage.getItem('op_token')).toBeNull();
 for(const [index,role] of ['comune','superadmin','user'].entries()) {
  const reloaded=openTab(tabs[index].storage);
  expect(reloaded.auth.getState().user.ruolo).toBe(role);
  const config=reloaded.api.interceptors.request.handlers[0].fulfilled({headers:{}});
  expect(config.headers.Authorization).toBe('Bearer token-'+role);
 }
 activate(tabs[0]);tabs[0].auth.getState().logout();
 expect(openTab(tabs[0].storage).auth.getState().user).toBeNull();
 expect(openTab(tabs[1].storage).auth.getState().user.ruolo).toBe('superadmin');
 expect(openTab(tabs[2].storage).auth.getState().user.ruolo).toBe('user');
});
test('a pending refresh cannot restore an account after logout',async()=>{
 const tab=openTab();tab.auth.getState().setSession({id:'old'},'old-token');
 let resolve;
 jest.spyOn(tab.api,'get').mockImplementation(()=>new Promise(done=>{resolve=done;}));
 const pending=tab.auth.getState().refresh();
 tab.auth.getState().logout();
 resolve({data:{id:'old'}});await pending;
 expect(tab.auth.getState().user).toBeNull();
 expect(tab.storage.getItem('op_token')).toBeNull();
});
