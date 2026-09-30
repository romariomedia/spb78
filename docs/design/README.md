# SportBuddy — Petersburg visual refresh

Updated the existing React application: authentication screen, discovery hero,
shared navigation, training cards and the default accent palette. River artwork
is a decorative SVG, not a geographical map. Sport shortcuts open the existing
training tab with its actual sport filter; counts use loaded training data.

Keyboard access, navigation current-page labels, reduced-motion preferences and
mobile safe-area spacing are included.

## Preview scope

- `auth-desktop.png`, `auth-mobile.png`: real application login screen.
- `city-desktop.png`, `city-mobile.png`: isolated composition of the actual
  CityPulse, TrainingCard and BottomNav components with example training data.
  This composition is a design preview, not an authenticated production session.

Browser checks: 1440×1000 and 390×844, no document horizontal overflow;
Tennis shortcut dispatches the expected filter in the preview.
Automated suite: 43 passing tests. Production build passes.

Not deployed to the VPS. Real-device authentication, verification and media
uploads still require end-to-end checks against the configured services.
