import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { OOHProposalMap } from "../OOHProposalMap";
jest.mock("react-leaflet", () => ({
 MapContainer: ({ children }) => <div>{children}</div>, TileLayer: () => null,
 CircleMarker: ({ children, center }) => <div data-point={center.join(',')}>{children}</div>,
 Polyline: ({ positions }) => <div data-line={JSON.stringify(positions)} />,
 Popup: ({ children }) => <div>{children}</div>, useMap: () => mockMap,
}), { virtual: true });
const mockMap = { invalidateSize: jest.fn(), fitBounds: jest.fn(), setView: jest.fn() };
global.IS_REACT_ACT_ENVIRONMENT = true;
test("switches municipality, filters circuits, connects only local points and supports exclusions", async () => {
 const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host); const exclude = jest.fn();
 const comuni = [{ id: 'r', nome: 'Roma' }, { id: 'm', nome: 'Milano' }];
 const item = (id, city, circuit, lat) => ({ id, comune_id: city, pacchetto_id: circuit, circuito_nome: circuit, codice: id, lat, lng: 12, costo: 10, motivi: [] });
 const proposal = { items: [item('a','r','Centro',41), item('b','r','Centro',42), item('c','r','Nord',43), item('d','m','Duomo',45)] };
 try {
  await act(async () => root.render(<OOHProposalMap proposal={proposal} comuni={comuni} onExclude={exclude} />));
  expect(host.querySelectorAll('[data-point]').length).toBe(3);
  const clickText = async (text) => { await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent.includes(text)).click()); };
  await clickText('Centro'); expect(host.querySelectorAll('[data-point]').length).toBe(2);
  expect(host.querySelector('[data-line]').getAttribute('data-line')).toBe('[[41,12],[42,12]]');
  await clickText('Milano'); expect(host.querySelectorAll('[data-point]').length).toBe(1);
  expect(host.textContent).toContain('Duomo');
  await clickText('Escludi'); expect(exclude).toHaveBeenCalledWith('d');
 } finally { act(() => root.unmount()); host.remove(); }
});
