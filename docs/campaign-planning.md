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

The current demo contains 15 OOH installations and no OSP areas; add OSP areas and their suitability data in the municipality backoffice to use OSP recommendations.

## Verification

From repository root:

```sh
.venv/bin/python backend/tests/test_campaign_planning.py
.venv/bin/python backend/tests/test_planning_api.py
cd frontend
yarn build
```

The API integration script requires `httpx` as a test-only dependency and a local MongoDB on port 27017. It creates a unique test database and drops only that database on completion. It checks inventory conflicts, minimum duration, exclusions, budget validation before writes, saved briefs and the existing OOH post-approval / OSP pre-submission payment rules.
