# Android website download

Owner supplied `sportbuddy78-rustore-v31.apk`, received 2026-10-27.
Size: 20,811,542 bytes.
SHA-256: `37340c4a896817c72512fcae4755207e9dd5cdb7e8711d8df7ad51d9b06d7a5f`.

Two binary parts avoid the connector's 16 MiB upload-request limit. The release script
reassembles them with `node scripts/prepare-android-download.mjs`, validates the complete
SHA-256, and writes `dist/downloads/sportbuddy78-rustore-v31.apk`.
The downloaded APK is byte-for-byte identical to the attachment; no rebuilding or re-signing.

Do NOT move the APK to public/: Capacitor would bundle it into future APK/IPA files.
For a local website preview, run `npm run build`, then the download preparation script,
then `npm run preview`. For native builds use the ordinary build/sync commands without this script.

After VPS deployment verify HTTP status, Content-Length and download hash. If nginx has a
location rule restricting file extensions, permit this download path as a static file with
`try_files $uri =404` and MIME type `application/vnd.android.package-archive`.

For future versions replace both parts, update checksum/size/name in the preparation script
and the button in InstallApp.tsx. Preserve the same Android signing key for installed-app updates.
