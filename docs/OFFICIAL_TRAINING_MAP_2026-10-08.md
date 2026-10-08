# Official training location editor

- Admin can select a start point by clicking the map or dragging the marker, and type coordinates as an accessible fallback.
- Name and address/meeting landmark can be edited. A venue-associated start point may be refined without changing the venue reference.
- Venue picker searches names, addresses and sports and includes the seed catalog plus managed unpublished and unmapped venues, excluding archived records.
- Research coordinates use the same venueLocation resolver as the public venue map. A changed address does not inherit stale seed coordinates.
- Private admin catalog is never written into public localStorage cache. Failed catalog loading is surfaced separately from training loading.
- Venue API URLs use apiBase for native builds.
- Server rejects null, empty and string coordinates instead of turning them into zero.

Validation: 227 tests pass, production TypeScript/Vite build passes. Regression cases cover catalog publication boundaries, seed coordinates, changed addresses, separate start points, editing coordinates and invalid input. Interactive visual verification on a deployed browser/device remains pending.

No environment variables or Firestore rule changes required.
