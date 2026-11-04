import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { DataTable } from "../DataTable";

global.IS_REACT_ACT_ENVIRONMENT = true;
let container, root;
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const data = [{ id: "a", nome: "Roma", totale: 20 }, { id: "b", nome: "Milano", totale: 3 }, { id: "c", nome: "Napoli", totale: 100 }];
const columns = [{ label: "Comune", key: "nome" }, { label: "Totale", key: "totale" }];
function render() { act(() => root.render(<DataTable data={data} columns={columns} pageSize={2} renderRow={(r) => <tr key={r.id}><td>{r.nome}</td><td>{r.totale}</td></tr>} />)); }
const rows = () => [...container.querySelectorAll("tbody tr")].map((r) => r.textContent);
const button = (text) => [...container.querySelectorAll("button")].find((b) => b.textContent.includes(text));
test("paginates and disables navigation at the boundaries", () => {
 render(); expect(rows()).toEqual(["Roma20", "Milano3"]);
 expect(container.querySelector('[aria-label="Pagina precedente"]').disabled).toBe(true);
 act(() => container.querySelector('[aria-label="Pagina successiva"]').click());
 expect(rows()).toEqual(["Napoli100"]);
 expect(container.querySelector('[aria-label="Pagina successiva"]').disabled).toBe(true);
});
test("sorts numeric columns numerically in both directions", () => {
 render(); act(() => button("Totale").click()); expect(rows()).toEqual(["Milano3", "Roma20"]);
 expect(container.querySelector('[aria-sort="ascending"]')).not.toBeNull();
 act(() => button("Totale").click()); expect(rows()).toEqual(["Napoli100", "Roma20"]);
});
test("filters without changing the original data and resets pagination", () => {
 render(); act(() => container.querySelector('[aria-label="Pagina successiva"]').click());
 const input = container.querySelector("input");
 act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "MILANO"); input.dispatchEvent(new Event("input", { bubbles: true })); });
 expect(rows()).toEqual(["Milano3"]); expect(data.map((r) => r.nome)).toEqual(["Roma", "Milano", "Napoli"]);
 act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "zzz"); input.dispatchEvent(new Event("input", { bubbles: true })); });
 expect(container.textContent).toContain("Nessun risultato");
});

test("searches and sorts displayed labels through custom accessors", () => {
 const mapped = [{ id: "1", city: "b" }, { id: "2", city: "a" }];
 const labels = { a: "Roma", b: "Milano" };
 act(() => root.render(<DataTable data={mapped} columns={[{ label: "Comune", key: "city", value: (r) => labels[r.city] }]} renderRow={(r) => <tr key={r.id}><td>{labels[r.city]}</td></tr>} />));
 act(() => button("Comune").click()); expect(rows()).toEqual(["Milano", "Roma"]);
 const input = container.querySelector("input");
 act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "Roma"); input.dispatchEvent(new Event("input", { bubbles: true })); });
 expect(rows()).toEqual(["Roma"]);
});
