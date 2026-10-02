# Geolocation audit — 2026-10-02

Location failures now reject instead of returning Krestovsky Island. DEFAULT_COORDS is a map viewport only. Browser requests use the browser API directly, with bounded waiting and readable denial/timeout messages; native requests use Capacitor permissions and accept approximate permission for discovery. Android foreground location permissions are declared.

Discovery distances and radar results are hidden until a real device fix is available. Training creation requires an explicit map selection. Map selection updates coordinates immediately and ignores out-of-order address responses; reverse geocoding times out after six seconds and falls back to coordinate text, without inventing a city. Map center is no longer presented as the user's position in training/admin selectors. OpenStreetMap attribution is visible.

Check-in requests a fresh fix (maximumAge 0), rejects reported accuracy worse than 150 metres, and never sends a default position on failure. Server rejects missing/non-numeric/out-of-range coordinates. Profile location timestamps come from the server. Nearby discovery excludes positions older than RECENT_WINDOW_MS; distance calculations retain precision and round only for display. Presence is cached only after the server accepts it.

Validation: 80 automated tests pass, including six new device/geolocation regressions and two server coordinate regressions; TypeScript and production build pass. Physical Android/iOS GPS and live geocoding availability have not been verified here.

Deployment: use the usual prepare-release/activate-release scripts for web/API. Android permission changes require rebuilding and installing the native application. No new environment variables or Firestore rules are introduced by this patch.

Manual acceptance: allow, deny and re-enable location on phone and laptop; verify denial never places the user in the default park; refresh location; choose two map points quickly and verify the last point/address wins; create a training without GPS using an explicit map pin; check in at the venue with precise location enabled and verify a distant position is rejected.

Limitations: discovery uses a snapshot, not background tracking; refresh after moving. Device coordinates can be spoofed, so GPS check-in is not cryptographic proof of attendance. Existing public profile coordinates and historical check-in access are not redesigned in this patch; a visual marker offset is not data-access protection. Public Nominatim remains an external reverse-geocoding dependency; a controlled provider/proxy and quota policy are needed before high traffic.
