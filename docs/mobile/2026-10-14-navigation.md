# Mobile navigation update

- Android Back: blur input first, consume top registered dialog, close chat, return profile subsection to overview, return to Discover, then minimize app. Uses Capacitor App backButton (not a custom OS edge gesture implementation).
- Shared dialog stack handles nested Modal, native media dialogs, welcome guide, venues (detail → list → close), recording screen (Back consumed during recording).
- Horizontal tab gestures on main content under 768px: minimum 72px, horizontal dominance 1.8x, maximum 650ms. Vertical displacement >28px, multitouch and touchcancel cancel recognition. No wrapping at endpoints. OS edge zones (24px), controls, horizontal scrollers, maps, dialogs, dating card, open chat and profile editor are excluded.
- Dating card explicitly uses touch-action pan-y so horizontal dragging is not consumed by browser panning; existing like/skip rules unchanged.
- Re-tapping active bottom tab scrolls to top. Narrow bottom nav and safe-area bottom padding adjusted. Reduced-motion preference disables tab slide animation.

## Validation
Run unit tests and production build. Before release test on Android: vertical scrolling without tab switches; horizontal switching on blank content; map pinch/pan; dating like/skip; media horizontal carousel; nested modal Back closes child only; chat Back returns list; keyboard Back; cancel and retry VK login; gesture navigation and three-button navigation; 320/360/412px layouts and large system font.

## Scope
No native push integration, predictive-Back interactive animation or general pull-to-refresh in this change. APK must be rebuilt with the same signing key and increased versionCode; server-only deployment cannot update bundled APK UI. Physical-device acceptance is still required.
