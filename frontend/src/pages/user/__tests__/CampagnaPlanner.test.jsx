import React, { act } from "react";
import { createRoot } from "react-dom/client";
import CampagnaPlanner from "../CampagnaPlanner";
import { api } from "../../../lib/api";
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock("../../../components/BackofficeLayout", () => ({ UserShell: ({ children }) => <div>{children}</div> }));
jest.mock("../../../components/DateRangePicker", () => ({ DateRangePicker: ({ onChange }) => <button onClick={() => onChange({ from: new Date(2027, 0, 1), to: new Date(2027, 0, 3) })}>Scegli periodo di prova</button>, fmtDay: (d) => d ? `2027-01-0${d.getDate()}` : "" }));
jest.mock("../../../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn() }, apiError: (e) => e.message, imgSrc: (s) => s }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
global.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
const spaces = [{ id: "r", nome: "Piazza Roma", citta: "Roma", comune_id: "roma", canone_giornaliero: 10, capienza: 100 }, { id: "m", nome: "Piazza Milano", citta: "Milano", comune_id: "milano", canone_giornaliero: 20, capienza: 100 }, { id: "high", nome: "Grande spazio", citta: "Roma", comune_id: "roma", canone_giornaliero: 100, capienza: 100 }];
const byTest = (id) => host.querySelector(`[data-testid="${id}"]`);
const button = (text) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(text));
async function click(el) { await act(async () => el.click()); }
function input(el, value) { act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); }); }
beforeEach(async () => {
 api.get.mockImplementation((url) => Promise.resolve({ data: url === "/comuni" ? [{ id: "roma", nome: "Roma", logo_url: "/api/uploads/roma.png" }, { id: "milano", nome: "Milano" }] : url === "/spazi/disponibili" ? spaces : { campi: [], documenti_richiesti: [] } }));
 api.post.mockResolvedValue({ data: { id: "campaign", pratiche: [{ id: "pr", spazio_id: "r", spazio_nome: "Piazza Roma", comune_id: "roma" }, { id: "pm", spazio_id: "m", spazio_nome: "Piazza Milano", comune_id: "milano" }] } });
 host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
 await act(async () => root.render(<CampagnaPlanner />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
async function reachSpaces() {
 input(byTest("campaign-budget"), "100"); input(byTest("osp-persone-previste"), "50"); await click(byTest("planner-next-button"));
 input(byTest("campagna-nome-input"), "Evento di prova"); await click(button("Scegli periodo di prova")); await click(byTest("planner-next-button"));
 expect(host.querySelector('img[alt="Logo Comune di Roma"]').getAttribute('src')).toBe('/api/uploads/roma.png');
 for (const cb of host.querySelectorAll('[type="checkbox"]')) await click(cb);
 await click(byTest("planner-next-button"));
}
test("budget and attendance first step has no objective, audience, contexts or proposal", async () => {
 expect(host.textContent).not.toMatch(/Obiettivo|Pubblico preferito|Contesti preferiti|Proposta/);
 await click(byTest("planner-next-button")); expect(byTest("planner-error").textContent).toContain("budget");
 await reachSpaces();
 expect(byTest("planner-spazi-grid")).not.toBeNull(); expect(host.querySelector(".leaflet-container")).toBeNull();
 expect(api.post).not.toHaveBeenCalled();
 expect(host.querySelectorAll('[aria-pressed="true"]').length).toBe(0);
 expect(byTest("osp-recommended-r")).not.toBeNull(); expect(byTest("osp-recommended-high")).toBeNull();
 expect(byTest("spazio-card-r").querySelector('.aspect-\\[4\\/3\\]')).not.toBeNull();
});
test("manual selection is required and only selected spaces are sent with a budget and attendance brief", async () => {
 await reachSpaces(); await click(byTest("planner-next-button")); expect(api.post).not.toHaveBeenCalled();
 await click(byTest("spazio-card-r")); await click(byTest("spazio-card-m"));
 expect(byTest("planner-totale").textContent).toContain("90.00");
 await click(byTest("planner-next-button"));
 expect(api.post).toHaveBeenCalledWith("/campagne", { nome: "Evento di prova", data_inizio: "2027-01-01", data_fine: "2027-01-03", spazi_ids: ["r", "m"], brief: { budget: 100, persone_previste: 50, comuni_ids: ["roma", "milano"], distribuzione: "tutti" } });
 expect(host.textContent).toContain("Moduli OSP");
});
test("manual choices above the budget cannot create practices", async () => {
 await reachSpaces(); await click(byTest("spazio-card-high")); await click(byTest("spazio-card-m")); await click(byTest("planner-next-button"));
 expect(byTest("planner-error").textContent).toContain("supera il budget"); expect(api.post).not.toHaveBeenCalled();
});

test("cards keep their position when selecting, deselecting and updating budget advice", async () => {
 await reachSpaces();
 const order = () => [...byTest("planner-spazi-grid").children].map((card) => card.dataset.testid);
 const before = order();
 const firstCard = byTest("spazio-card-r");
 await click(firstCard);
 expect(order()).toEqual(before);
 expect(byTest("spazio-card-r")).toBe(firstCard);
 expect(firstCard.getAttribute("aria-pressed")).toBe("true");
 expect(byTest("planner-totale").textContent).toContain("30.00");
 await click(byTest("spazio-card-m"));
 expect(order()).toEqual(before);
 expect(byTest("spazio-card-m").getAttribute("aria-pressed")).toBe("true");
 await click(firstCard);
 expect(order()).toEqual(before);
 expect(firstCard.getAttribute("aria-pressed")).toBe("false");
});

test("attendance is required before advancing from the first step", async () => {
 input(byTest("campaign-budget"), "100");
 await click(byTest("planner-next-button"));
 expect(byTest("planner-error").textContent).toContain("persone previste");
 expect(byTest("osp-budget-step")).not.toBeNull();
});
