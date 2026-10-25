# Android website download

Owner supplied `sportbuddy78-rustore-v28.apk`, received 2026-10-25.
Size: 20,757,933 bytes.
SHA-256: `643fda2ab52e1c0ad30b07e2ac7e8c02ee044e2df161be7e5242a85b3b22a2d7`.

Two binary parts avoid the connector's 16 MiB upload-request limit. The release script
reassembles them with `node scripts/prepare-android-download.mjs`, validates the complete
SHA-256, and writes `dist/downloads/sportbuddy78-rustore-v28.apk`.
The downloaded APK is byte-for-byte identical to the attachment; no rebuilding or re-signing.

Do NOT move the APK to public/: Capacitor would bundle it into future APK/IPA files.
For a local website preview, run `npm run build`, then the download preparation script,
then `npm run preview`. For native builds use the ordinary build/sync commands without this script.

After VPS deployment verify HTTP status, Content-Length and download hash. If nginx has a
location rule restricting file extensions, permit this download path as a static file with
`try_files $uri =404` and MIME type `application/vnd.android.package-archive`.

For future versions replace both parts, update checksum/size/name in the preparation script
and the button in InstallApp.tsx. Preserve the same Android signing key for installed-app updates.
