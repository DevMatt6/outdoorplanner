import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { CatalogPlanningFields } from "../CampaignBrief";
global.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
test("OSP catalog exposes only surface and capacity while preserving the saved values", () => {
 const update = jest.fn();
 act(() => root.render(<CatalogPlanningFields osp value={{ superficie_mq: 75, capienza: 100 }} onChange={update} />));
 expect(host.querySelectorAll("input").length).toBe(2);
 expect(host.textContent).not.toMatch(/Contesti effettivi|Pubblici pertinenti|Attività ammesse/);
 const capacity = host.querySelector('[data-testid="osp-capienza"]');
 expect(capacity.value).toBe("100");
 act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(capacity, "120"); capacity.dispatchEvent(new Event("input", { bubbles: true })); });
 expect(update).toHaveBeenCalledWith({ superficie_mq: 75, capienza: 120 });
});
test("OOH catalog keeps its existing targeting controls", () => {
 act(() => root.render(<CatalogPlanningFields value={{}} onChange={() => {}} />));
 expect(host.textContent).toContain("Contesti effettivi"); expect(host.textContent).toContain("Pubblici pertinenti");
 expect(host.querySelector('[data-testid="osp-capienza"]')).toBeNull();
});
