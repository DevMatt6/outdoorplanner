import React, { act } from "react";
import { createRoot } from "react-dom/client";
import FormBuilder from "../FormBuilder";
import { api } from "../../../lib/api";
jest.mock("../../../lib/api", () => ({ api: { get: jest.fn(), put: jest.fn() }, apiError: String }));
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
