import React, { act } from "react";
import { createRoot } from "react-dom/client";
import AdminDashboard from "../AdminDashboard";
import { api } from "../../../lib/api";
jest.mock("../../../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() }, apiError: String }));
jest.mock("../../../components/BackofficeLayout", () => ({ BackofficeLayout: ({ children }) => <div>{children}</div> }));
jest.mock("recharts", () => ({ ResponsiveContainer: () => null }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
global.IS_REACT_ACT_ENVIRONMENT = true;
test.each([['pratiche-campagne', 'reset-pratiche-campagne'], ['piattaforma', 'reset-piattaforma']])("confirms reset %s with the matching endpoint", async (button, endpoint) => {
 api.get.mockImplementation((path) => Promise.resolve({ data: path === '/admin/comuni' ? [] : { per_stato: {}, revenue_totale: 0 } }));
 api.post.mockResolvedValue({}); api.post.mockClear();
 const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
 try {
  await act(async () => root.render(<AdminDashboard />));
  await act(async () => container.querySelector(`[data-testid="btn-reset-${button}"]`).click());
  const confirm = document.querySelector('[data-testid="btn-conferma-reset"]');
  expect(confirm.disabled).toBe(true); expect(api.post).not.toHaveBeenCalled();
  const input = document.querySelector('[data-testid="input-conferma-reset"]');
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "RESET"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  expect(confirm.disabled).toBe(false);
  await act(async () => confirm.click());
  expect(api.post).toHaveBeenCalledWith(`/admin/${endpoint}`, { conferma: 'RESET' });
 } finally { act(() => root.unmount()); container.remove(); }
});
