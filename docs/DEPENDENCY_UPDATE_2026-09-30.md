# Dependency security update, 30 September 2026

The VPS's pinned release had 15 production audit findings (7 high, 8 moderate).
The complete development + production tree had 18 reported findings.

## Changes

- Firebase client 12.19.0, retaining major 12 rather than npm's proposed rollback.
- Firebase Admin 14.5.0; Node >=22 explicitly required. This is a major upgrade.
- Nodemailer 10.0.13; removed @types/nodemailer because v10 ships types.
- Vite 7.3.6 and explicit esbuild 0.28.1 (also used by our test harness).
- Lockfile patches for xmldom and brace-expansion.
- @grpc/grpc-js override 1.14.5: the client Firestore dependency still requests
  an older vulnerable minor. The override retains the gRPC major version.
- Scoped gaxios -> uuid 11.1.1 override. Installed gaxios 6 uses uuid.v4 for MIME
  boundaries; preserve CommonJS compatibility instead of forcing root uuid 14.
- Release preparation now blocks on high/critical npm audit findings and on
  audit-service errors. It still performs a clean install, tests and build.

## Validation

Clean npm ci, 55 tests and production build pass. Full npm audit reports zero
known vulnerabilities at check time, including development dependencies.
Additional tests load the real Admin SDK and all 11 API handlers using an
in-memory generated test certificate, and create local MIME messages using
Nodemailer's stream transport. No email is sent and no production credentials
or Firebase calls are used. These checks do not replace real service testing.

Deprecation notices for transitive glob/node-domexception may remain; they are
not equivalent to an audit vulnerability finding. Audit results change over time.

## Upstream references

- https://github.com/firebase/firebase-admin-node/releases
- https://github.com/nodemailer/nodemailer
- https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j

Prepare a new release directory from this commit. Keep the previous prepared
release and running /opt/sportbuddy-api untouched until successful activation.
