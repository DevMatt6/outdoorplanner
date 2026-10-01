# Campaign planning OOH / OSP

Both planners start with a campaign brief: objective, maximum budget for the full period, preferred audiences and contexts, and distribution across municipalities. OOH can require a format; OSP can require an allowed activity and minimum surface. Drive-to-store can optionally filter by straight-line distance from supplied store coordinates. An address alone is not geocoded.

`POST /api/planning/recommend` accepts `tipo`, `brief`, ISO date strings and optional excluded installation/space IDs. It reads current availability using the same services as the catalog. The proposal does not reserve inventory. Creation rechecks availability, minimum duration, catalog eligibility, requested cities and the budget before writing practices or reservations. Briefs are optional for compatibility with existing API integrations; the new planners always submit one.

Prices are calculated for the entire inclusive period and rounded per space/installation to cents. The budget covers catalog rents only, excluding production, printing, setup, creative services and other additional costs.

## Transparent scoring

- Base suitability: 10 points.
- Matching preferred context or audience: 25 points per catalog match.
- Context supporting the objective: 20 points.
- Maxi format for awareness or digital format for engagement: 15 points.
- Drive-to-store proximity: up to 30 points, decreasing with distance.
- Compatible OSP activity: 20 points; surface is a hard eligibility constraint.
- Awareness adds a 15-point allocation bonus for a new zone.

For presence in every city, reserve the cheapest eligible item in each city first. If that minimum is unavailable or unaffordable, return an empty proposal with an explanation. Allocate remaining budget by suitability per euro, with the awareness diversity bonus. Best overall omits the minimum-presence requirement. This is a deterministic heuristic, not a guarantee of globally optimal results or advertising performance. Each returned item includes its reasons. Exclusion recalculates the proposal; applying it initializes the existing manual selector.

Catalog editors let municipalities supply real contexts and relevant audiences, and for OSP allowed activities and available square metres. Unknown context/audience data do not imply measured reach. Missing OSP data exclude areas when activity/surface requirements were specified. No traffic, impression or conversion measurements are fabricated.

The signed-in OSP entry point `/spazi` opens the multistep planner; `/spazi/catalogo` remains the browsable catalog. `/campagne/nuova` is also available.

Run `.venv/bin/python backend/seed_demo.py` to populate the configured database. The rich seed preserves existing edits and uses stable IDs. In a clean three-city database it supplies 18 zones, 195 OOH installations, 60 circuits, 108 OSP areas and OOH/OSP form templates. It includes all nine OOH typologies, minimum durations of 1/3/7/14 days, varying daily prices, audience/context labels, four OSP activities and surfaces from 30 to 1000 m². Positions and suitability attributes are synthetic and marked as demo; no real traffic/visibility measurements are asserted. Existing campaigns, reservations and accounts are preserved. It does not create fake occupancy or transactions.

## Verification

From repository root:

```sh
.venv/bin/python backend/tests/test_campaign_planning.py
.venv/bin/python backend/tests/test_planning_api.py
.venv/bin/python backend/tests/test_rich_seed.py
cd frontend
yarn build
```

The API integration script requires `httpx` as a test-only dependency and a local MongoDB on port 27017. It creates a unique test database and drops only that database on completion. It checks inventory conflicts, minimum duration, exclusions, budget validation before writes, saved briefs and the existing OOH post-approval / OSP pre-submission payment rules.

Local advertiser demo: `user@demo.it` / `demo123`. Commune operators: `roma.l1@demo.it`, `roma.l2@demo.it`, `roma.l3@demo.it` (similarly `napoli` and `milano`), password `demo123` for newly seeded accounts; existing passwords are preserved.
