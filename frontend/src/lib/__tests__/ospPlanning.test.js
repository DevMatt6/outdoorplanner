import { initialOSPBrief, ospBriefPayload, ospBudgetError, ospPeopleError, ospAvailable, ospCost, ospBudgetAdvice } from "../ospPlanning";
const spaces = [
 { id: "r", comune_id: "roma", canone_giornaliero: 10 },
 { id: "r2", comune_id: "roma", canone_giornaliero: 20 },
 { id: "m", comune_id: "milano", canone_giornaliero: 20 },
];
test("OSP requires a valid budget and attendance and sends no hidden objective or targeting", () => {
 expect(ospBudgetError("")).toBeTruthy(); expect(ospBudgetError(-1)).toBeTruthy(); expect(ospBudgetError(Infinity)).toBeTruthy();
 expect(ospBudgetError("0.01")).toBe("");
 expect(ospBriefPayload({ ...initialOSPBrief(), budget: "90", persone_previste: "50" }, ["roma", "milano"])).toEqual({ budget: 90, persone_previste: 50, distribuzione: "tutti", comuni_ids: ["roma", "milano"] });
});
test("recommendations reserve enough budget for the other municipalities and never select items", () => {
 const selected = [];
 const advice = ospBudgetAdvice(spaces, selected, ["roma", "milano"], 90, 3);
 expect([...advice.recommended]).toEqual(["r", "m"]); expect(selected).toEqual([]); expect(advice.feasible).toBe(true);
 const after = ospBudgetAdvice(spaces, ["r"], ["roma", "milano"], 90, 3);
 expect(after.total).toBe(3000); expect(after.remaining).toBe(6000); expect([...after.recommended]).toEqual(["m"]);
});
test("insufficient budget or an unavailable municipality yields no misleading recommendations", () => {
 expect(ospBudgetAdvice(spaces, [], ["roma", "milano"], 89, 3).feasible).toBe(false);
 expect(ospBudgetAdvice(spaces, [], ["roma", "napoli"], 500, 3).recommended.size).toBe(0);
});
test("availability and minimum duration remain hard constraints", () => {
 const extra = [{ ...spaces[0], id: "off", disponibile: false }, { ...spaces[0], id: "held", occupato: true }, { ...spaces[0], id: "long", giorni_minimi: 5 }];
 expect(ospAvailable([...spaces, ...extra], ["roma"], 3).map((s) => s.id)).toEqual(["r", "r2"]);
 expect(ospCost({ canone_giornaliero: 0.1 }, 3)).toBe(30);
});

test("attendance must be a positive integer and unknown or insufficient capacities are excluded", () => {
 for (const value of ["", 0, -1, 2.5, Infinity, "bad"]) expect(ospPeopleError(value)).toBeTruthy();
 expect(ospPeopleError("50")).toBe("");
 const catalog = [{ ...spaces[0], capienza: 50 }, { ...spaces[1], capienza: 49 }, spaces[2]];
 expect(ospAvailable(catalog, ["roma", "milano"], 3, 50).map((s) => s.id)).toEqual(["r"]);
 expect(ospAvailable(catalog, ["roma", "milano"], 3).length).toBe(3);
});
