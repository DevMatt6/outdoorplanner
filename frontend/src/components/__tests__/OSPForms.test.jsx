import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { OSPForms } from '../OSPForms';
import { api } from '../../lib/api';
jest.mock('../../lib/api', () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn() }, apiError: e => e.message }));
global.IS_REACT_ACT_ENVIRONMENT = true;
let host, root, ref;
const template = { campi: [
  { id: 'nome', label: 'Nome', tipo: 'text', scope: 'comune', profilo: true, required: true },
  { id: 'nascita', label: 'Comune di nascita', tipo: 'text', scope: 'comune', required: true },
  { id: 'conferma', label: 'Dichiarazione', tipo: 'checkbox', scope: 'comune', required: true },
  { id: 'mq', label: 'Superficie', tipo: 'number', min: 0, scope: 'area', required: true },
], documenti_richiesti: [{ id: 'plan', label: 'Planimetria', required: true }] };
const practice = (id, comune_id = 'roma') => ({ id, comune_id, spazio_id: id, spazio_nome: `Area ${id}`, richiedente: { nome: 'Mario Rossi' }, dati_form: { nome: 'Mario Rossi', nascita: 'Roma', conferma: true, mq: 0 }, form_template_snapshot: template, documenti: [] });
async function render(pratiche) { await act(async () => root.render(<OSPForms ref={ref} pratiche={pratiche} campagnaId="c" comuneNome={id => id} />)); }
async function upload(practiceId) {
  const el=host.querySelector(`[data-testid="upload-pratica-${practiceId}-plan"]`);
  Object.defineProperty(el,'files',{value:[new File(['plan'],'plan.pdf',{type:'application/pdf'})],configurable:true});
  await act(async () => el.dispatchEvent(new Event('change',{bubbles:true})));
}
beforeEach(() => { host=document.createElement('div'); document.body.appendChild(host); root=createRoot(host); ref=createRef(); api.put.mockResolvedValue({data:{ok:true}}); api.post.mockImplementation(url => Promise.resolve({data:{id:url, tipo:'plan',nome:'plan.pdf'}})); });
afterEach(() => { act(() => root.unmount()); host.remove(); jest.clearAllMocks(); });
test('two areas share common fields once, profile is displayed, area values and documents stay separate', async () => {
  await render([practice('a'),practice('b')]);
  expect(host.querySelectorAll('[data-testid="field-nascita"]').length).toBe(1);
  expect(host.querySelectorAll('[data-testid="field-nome"]').length).toBe(0);
  expect(host.textContent).toContain('Mario Rossi');
  expect(host.querySelectorAll('[data-testid="field-mq"]').length).toBe(2);
  expect(host.querySelector('[data-testid="field-mq"]').value).toBe('0');
  await upload('a'); let valid;
  await act(async () => { valid=await ref.current.save(true); });
  expect(valid).toBe(false); expect(host.textContent).toContain('Area b: Allegato: Planimetria'); expect(api.put).not.toHaveBeenCalled();
  await upload('b');
  const el=host.querySelector('[data-testid="field-nascita"]');
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Milano'); el.dispatchEvent(new Event('input',{bubbles:true})); });
  await act(async () => { valid=await ref.current.save(true); });
  expect(valid).toBe(true);
  expect(api.put).toHaveBeenCalledTimes(2);
  for (const [,body] of api.put.mock.calls) expect(body.dati_form).toEqual({nome:'Mario Rossi',nascita:'Milano',conferma:true,mq:0});
});
test('different municipalities have independent common fields and unique accessible IDs', async () => {
  await render([practice('a'),practice('b','milano')]);
  const fields=[...host.querySelectorAll('[data-testid="field-nascita"]')];
  expect(fields.length).toBe(2); expect(fields[0].id).not.toBe(fields[1].id);
});
test('unchecked required declarations block completion but permit saving an incomplete draft', async () => {
  const p=practice('a'); p.dati_form.conferma=false; p.documenti=[{tipo:'plan',nome:'already.pdf'}];
  await render([p]); let valid;
  await act(async () => { valid=await ref.current.save(true); });
  expect(valid).toBe(false); expect(host.textContent).toContain('Dichiarazione');
  await act(async () => { valid=await ref.current.save(false); });
  expect(valid).toBe(true);
});
