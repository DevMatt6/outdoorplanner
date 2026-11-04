import React, { act } from "react";
import { createRoot } from "react-dom/client";
import UserDashboard from "../UserDashboard";
import Campagne from "../Campagne";
import { api } from "../../../lib/api";
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock("../../../components/BackofficeLayout", () => ({ UserShell: ({ children }) => <div>{children}</div> }));
jest.mock("../../../components/ConfirmDialog", () => ({ useConfirm: () => async () => true }));
jest.mock("../../../store/auth", () => ({ useAuth: () => ({ user: { nome: "Utente" } }) }));
jest.mock("../../../lib/api", () => ({ api: { get: jest.fn(), delete: jest.fn() }, apiError: (e) => e.message }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
global.IS_REACT_ACT_ENVIRONMENT = true;
const practices = [
 { id: "p1", spazio_nome: "Piazza eventi", comune_id: "roma", comune_nome: "Roma", tipo: "OSP", data_inizio: "2027-01-01", data_fine: "2027-01-03", importo: 30, stato: "BOZZA" },
 { id: "p2", spazio_nome: "Circuito centro", comune_id: "milano", comune_nome: "Milano", campagna_id: "ooh", tipo: "OOH", data_inizio: "2027-02-01", data_fine: "2027-02-03", importo: 60, stato: "INVIATA" },
];
const campaigns = [
 { id: "ooh", nome: "Campagna outdoor", tipo: "OOH", data_inizio: "2027-02-01", data_fine: "2027-02-03", importo_totale: 60, pacchetti_ids: ["c"], pratiche: [practices[1]], per_stato: { INVIATA: 1 } },
 { id: "osp", nome: "Evento", tipo: "OSP", data_inizio: "2027-01-01", data_fine: "2027-01-03", importo_totale: 30, spazi_ids: ["s"], pratiche: [practices[0]], per_stato: { BOZZA: 1 } },
];
let host, root;
beforeEach(() => {
 api.get.mockImplementation((url) => Promise.resolve({ data: url === "/pratiche" ? practices : campaigns })); api.delete.mockResolvedValue({ data: { ok: true } });
 host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
async function render(Component) { await act(async () => root.render(<Component />)); }
test("practices have distinct columns and can be searched by municipality", async () => {
 await render(UserDashboard);
 expect([...host.querySelectorAll("th")].map((h) => h.textContent)).toEqual(["Spazio / Circuito", "Comune / Città", "Tipo", "Dal", "Al", "Importo", "Stato", "Azioni"]);
 expect(host.querySelector('[data-testid="pratica-comune-p1"]').textContent).toBe("Roma");
 const input = host.querySelector("input");
 act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "Milano"); input.dispatchEvent(new Event("input", { bubbles: true })); });
 expect(host.querySelectorAll("tbody tr").length).toBe(1);
 expect(host.querySelector("tbody").textContent).toContain("Circuito centro");
 expect(host.querySelector('tbody a').getAttribute("href")).toBe("/pratiche/p2");
});
test("state filters and confirmed draft deletion are preserved", async () => {
 await render(UserDashboard);
 expect(host.querySelector('[data-testid="delete-pratica-p2"]')).toBeNull();
 await act(async () => host.querySelector('[data-testid="filtro-INVIATA"]').click());
 expect(host.querySelectorAll("tbody tr").length).toBe(1);
 await act(async () => host.querySelector('[data-testid="filtro-tutte"]').click());
 await act(async () => host.querySelector('[data-testid="delete-pratica-p1"]').click());
 expect(api.delete).toHaveBeenCalledWith("/pratiche/p1");
 expect(host.querySelector('[data-testid="pratica-row-p1"]')).toBeNull();
});
test("campaign tables keep OOH/OSP detail destinations and separate standalone requests", async () => {
 await render(Campagne);
 const table = host.querySelector('[data-testid="campagne-table"]');
 expect(table.querySelectorAll("tbody tr").length).toBe(2);
 expect(table.querySelector('[data-testid="campagna-card-ooh"]').getAttribute("href")).toBe("/campagne/ooh/ooh");
 expect(table.querySelector('[data-testid="campagna-card-osp"]').getAttribute("href")).toBe("/campagne/osp");
 expect(table.querySelector('thead').textContent).toContain("Stato pratiche");
 const single = host.querySelector('[data-testid="pratiche-singole"]');
 expect(single.querySelectorAll("tbody tr").length).toBe(1);
 expect(single.querySelector('[data-testid="pratica-comune-p1"]').textContent).toBe("Roma");
});
