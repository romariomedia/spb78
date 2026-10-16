# Android launcher icon

Updated 2026-10-16 from the owner-supplied neon S78 emblem.

## Assets

- `store-assets/icon/s78-source.png`: unchanged original artwork.
- `store-assets/icon/icon-1024.png`: square master, fitted without distortion.
- `store-assets/icon/icon-512.png`: store artwork export.
- `store-assets/icon/icon-foreground.png`: 1080px adaptive layer, 660px centred artwork.
- Android mipmap densities contain legacy square/round icons at 48/72/96/144/192px and foreground layers at 108/162/216/324/432px.
- Foreground artwork occupies 66 of 108dp, with transparent outer padding. Background is black. Original artwork and slogan are preserved; small details are not expected to be readable at launcher size.
- Android 26+ retains existing adaptive XML references. Android 33+ adds a separate white S vector for themed monochrome icons. The launcher chooses its tint; it is intentionally simplified.

Safe area: https://developer.android.com/develop/ui/compose/system/icon_design_adaptive

## Release

Build `RuStore signed APK` from the updated commit, with versionCode higher than the installed/published build and the existing signing key. Install as an update, then check circular and rounded-square launchers and themed icons where supported. No VPS release is required for this asset-only change. Notification status icon remains the separate small white notification symbol.

Do not run a default Capacitor asset generator over these files without using the supplied master and safe-area layout: that can restore or crop the launcher artwork.
