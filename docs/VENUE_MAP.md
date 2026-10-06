# Places map

The catalog offers List / Map views with shared search and sport/status filters.
All 51 seed venues have stored locations in src/lib/venueLocations.json with
source URL, original address, precision and lookup date. Locations represent
venue/address positions, not certified entrances. OSM-derived locations are
attributed to OpenStreetMap; source URLs retain object provenance.

No geocoding requests are made at runtime. Coordinates enrich existing cached
and Firestore seed records by ID and matching address, so no database reseed
or overwrite is required. Administrator coordinates take precedence. An address
change clears the form's coordinates; an unknown/changed address without a valid
point appears in the explicit unresolved list instead of a guessed city-center pin.

Several venues at the same coordinates share a selectable popup. Popups show
name, address, sports, starting price/conditions and open the existing detail
card. Map zoom fits filtered results. Map is lazy-loaded; geolocation permission
is not required. Leaflet CSS is bundled locally for this view.

New venues can be placed using latitude/longitude fields in the existing
OTP-protected admin panel. Client/server reject invalid coordinate shapes from
use on the map. Base tiles use the existing OpenStreetMap provider; only visible
tiles are requested (no prefetch/offline downloads).

Verification: 114 Node tests passed, TypeScript/production build passed.
Browser automation unavailable in the execution environment (agent-browser
failed to start; browser installation failed certificate validation).
After deployment check phone and desktop: open Places -> Map, filter sport,
open a marker -> detail -> back, test overlapping venues Molniya/Luzhaika,
then add/edit a draft venue's coordinates in admin. Never publish a test venue.
