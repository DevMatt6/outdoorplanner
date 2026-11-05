import React, { act } from "react";
import { createRoot } from "react-dom/client";
import FormBuilder from "../FormBuilder";
import { api } from "../../../lib/api";
jest.mock("../../../lib/api", () => ({ api: { get: jest.fn(), put: jest.fn(), post: jest.fn() }, apiError: String, imgSrc: (url) => url }));
jest.mock("../../../components/BackofficeLayout", () => ({ BackofficeLayout: ({ children }) => <div>{children}</div> }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
global.IS_REACT_ACT_ENVIRONMENT = true;
test("edits an existing field while retaining its ID and extended rules", async () => {
 const template = { id: "tpl", nome: "Test", campi: [{ id: "original", label: "Nome", tipo: "text", required: true, scope: "comune", readonly: true, condizione: { campo: "other", valore: "yes" } }], documenti_richiesti: [] };
 api.get.mockResolvedValue({ data: [template] }); api.put.mockResolvedValue({});
 const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
 try {
  await act(async () => root.render(<FormBuilder />));
  await act(async () => container.querySelector('[aria-label="Obbligatorio original"]').click());
  const field = container.querySelector('[aria-label="Etichetta original"]');
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(field, "Nuovo nome"); field.dispatchEvent(new Event("input", { bubbles: true })); });
  await act(async () => container.querySelector('[data-testid="salva-template-button"]').click());
  expect(api.put).toHaveBeenCalledWith("/comune/form-templates/tpl", expect.objectContaining({ campi: [expect.objectContaining({ id: "original", label: "Nuovo nome", required: false, scope: "comune", readonly: true, condizione: template.campi[0].condizione })] }));
 } finally { act(() => root.unmount()); container.remove(); }
});

test("uploads a model for a new document, replaces an existing source and saves both", async () => {
 const template = { id: "tpl", nome: "Test", campi: [], documenti_richiesti: [{ id: "existing", label: "Istanza", required: true, fonte_url: "https://example.org/old.pdf", condizione: { campo: "x", valore: true } }] };
 api.get.mockResolvedValue({ data: [template] }); api.put.mockClear(); api.put.mockResolvedValue({});
 api.post.mockResolvedValue({ data: { url: "/api/uploads/modelli/rome/new.pdf", nome: "modello.pdf" } });
 const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
 const change = async (element, value) => act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
 try {
  await act(async () => root.render(<FormBuilder />));
  await change(container.querySelector('[aria-label="Link modello existing"]'), 'https://example.org/replaced.pdf');
  await change(container.querySelector('[data-testid="nuovo-doc-label"]'), 'Nuovo allegato');
  const upload = container.querySelector('[aria-label="Carica modello nuovo documento"]');
  await act(async () => { Object.defineProperty(upload, 'files', { value: [new File(['pdf'], 'modello.pdf', {type:'application/pdf'})] }); upload.dispatchEvent(new Event('change', {bubbles:true})); });
  await act(async () => container.querySelector('[data-testid="aggiungi-doc-button"]').click());
  expect(container.querySelector('a[href="/api/uploads/modelli/rome/new.pdf"]')).not.toBeNull();
  await act(async () => container.querySelector('[data-testid="salva-template-button"]').click());
  expect(api.put.mock.calls[0][1].documenti_richiesti).toEqual([
   expect.objectContaining({id:'existing', fonte_url:'https://example.org/replaced.pdf', condizione:{campo:'x',valore:true}}),
   expect.objectContaining({id:'nuovo_allegato', fonte_url:'/api/uploads/modelli/rome/new.pdf', fonte_nome:'modello.pdf'}),
  ]);
 } finally { act(() => root.unmount()); container.remove(); }
});
