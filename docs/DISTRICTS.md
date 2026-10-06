# Profile and training districts

Shared catalog: 18 Saint Petersburg districts and 18 Leningrad Oblast territories.
Names follow official regional lists (checked 2026-10-06):
- https://www.gov.spb.ru/gov/terr/
- https://budget.lenobl.ru/budget/num/region/compare/

Oblast labels use short territory names without guessing changing municipal
status. Stable spb-/lo- IDs distinguish Vyborgsky and Kirovsky names.

Optional users.districtId describes residence; trainings.districtId describes
the meeting/start location. Neither overwrites coordinates or locationName.
No automatic migration guesses a district from old free text or GPS.
Profile editing offers a grouped select and explicit clearing. Summary and
profile cards show the district when present, otherwise legacy location text.
New web training forms require a district; API accepts omission for old APKs,
but rejects unknown IDs. Residence never restricts training signup.
Search combines district with existing sport/level/date/membership filters.
All districts includes legacy trainings; a specific district only includes exact
matching IDs. My district uses the saved profile value.

Validation: 118 tests and production build passed. Includes server persistence,
clear/preserve behavior, malformed district rejection, joining from a different
home district, old client compatibility, ambiguous names and legacy search.
Mobile browser appearance is not yet verified on a real device.

After deployment: save a district in Profile, reload, use My district in Trainings,
create a training with a different meeting district, and verify exact filtering.
No Firestore reseeding, new index, or rule changes are required.
