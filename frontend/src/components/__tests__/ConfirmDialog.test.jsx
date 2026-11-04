import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { ConfirmProvider, useConfirm } from "../ConfirmDialog";
global.IS_REACT_ACT_ENVIRONMENT = true;
let container, root, result;
function Consumer() {
 const confirm = useConfirm();
 return <button onClick={async () => { result = await confirm("Eliminare la bozza?"); }}>Elimina</button>;
}
beforeEach(() => { result = undefined; container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); act(() => root.render(<ConfirmProvider><Consumer /></ConfirmProvider>)); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const find = (text) => [...document.querySelectorAll("button")].find((b) => b.textContent === text);
test("cancel resolves false without approving the action", async () => {
 await act(async () => find("Elimina").click());
 expect(document.querySelector('[role="alertdialog"]')).not.toBeNull(); expect(result).toBeUndefined();
 await act(async () => find("Annulla").click()); expect(result).toBe(false);
});
test("only explicit confirmation resolves true", async () => {
 await act(async () => find("Elimina").click());
 await act(async () => find("Conferma").click()); expect(result).toBe(true);
});
