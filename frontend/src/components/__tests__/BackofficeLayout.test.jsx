import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { BackofficeLayout, COMUNE_LINKS, USER_LINKS } from "../BackofficeLayout";
import { api } from "../../lib/api";
import { useAuth } from "../../store/auth";
jest.mock("../../store/auth", () => ({ useAuth: jest.fn(), homeFor: (user) => user.ruolo === "user" ? "/home" : "/comune" }));
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>, useLocation: () => ({ pathname: "/comune" }), useNavigate: () => jest.fn() }), { virtual: true });
jest.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: jest.fn() }) }));
jest.mock("../NotificationBell", () => ({ NotificationBell: () => null }));
jest.mock("../../lib/api", () => ({ api: { get: jest.fn().mockResolvedValue({ data: { nome: "Roma" } }) }, imgSrc: (v) => v }));
jest.mock("../ui/command", () => {
 const Wrapper = ({ children }) => <div>{children}</div>;
 return { Command: Wrapper, CommandInput: Wrapper, CommandList: Wrapper, CommandEmpty: Wrapper, CommandGroup: Wrapper, CommandItem: Wrapper };
});
global.IS_REACT_ACT_ENVIRONMENT = true;
let container, root;
beforeEach(() => { api.get.mockResolvedValue({ data: { nome: "Roma" } }); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
async function render(user, links) { useAuth.mockReturnValue({ user, logout: jest.fn() }); await act(async () => root.render(<BackofficeLayout title="Test" links={links}><h1>Contenuto</h1></BackofficeLayout>)); }
test.each([1, 2])("L%s keeps municipality management links hidden", async (livello) => {
 await render({ nome: "Operatore", ruolo: "comune", livello }, COMUNE_LINKS);
 expect(container.querySelector('[data-testid="link-scrivania"]')).not.toBeNull();
 expect(container.querySelector('[data-testid="link-report"]')).not.toBeNull();
 expect(container.querySelector('[data-testid="link-zone"]')).toBeNull();
 expect(container.querySelector('[data-testid="link-impianti"]')).toBeNull();
});
test("L3 retains the full municipality navigation", async () => {
 await render({ nome: "Responsabile", ruolo: "comune", livello: 3 }, COMUNE_LINKS);
 expect(container.querySelectorAll('nav[aria-label="Navigazione principale"] a').length).toBe(COMUNE_LINKS.length);
});
test("user can reach practices and collapsing preserves every destination", async () => {
 await render({ nome: "Utente", ruolo: "user" }, USER_LINKS);
 expect(container.querySelector('[data-testid="link-pratiche-user"]').getAttribute("href")).toBe("/dashboard");
 act(() => container.querySelector('[data-testid="sidebar-collapse"]').click());
 expect(container.querySelector('[data-testid="link-pratiche-user"]').getAttribute("aria-label")).toBe("Le mie pratiche");
 expect(localStorage.getItem("op_sidebar_collapsed")).toBe("true");
});
test("municipality logo remains visible in expanded and collapsed sidebar", async () => {
 localStorage.removeItem('op_sidebar_collapsed');
 api.get.mockResolvedValue({ data: { nome: 'Roma', logo_url: '/api/uploads/roma.png' } });
 await render({ nome: 'Operatore', ruolo: 'comune', livello: 3 }, COMUNE_LINKS);
 expect(container.querySelector('[data-testid="comune-logo-sidebar"] img').getAttribute('src')).toBe('/api/uploads/roma.png');
 act(() => container.querySelector('[data-testid="sidebar-collapse"]').click());
 expect(container.querySelector('aside img[alt="Logo Comune di Roma"]')).not.toBeNull();
});
