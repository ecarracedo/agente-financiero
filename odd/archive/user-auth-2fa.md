# User authentication with 2FA
Objective: protect the deployed single-user app with login (hashed password) + TOTP second factor. Branch: dev. Test runner: backend `python -m pytest backend/tests -q`, frontend `npx vitest run`.

## Specs
- S1: "Login con usuario + contraseña hasheada en Postgres" — user `ecarracedo`, email `ecarracedo@gmail.com`, password stored only as hash, never plaintext in repo.
- S2: "2FA con código TOTP (tipo Google Authenticator)" — enrollment with QR/otpauth, verification on login.
- S3: "Protección en backend + pantalla de login en el frontend" — all `/api/v1` routes require auth; frontend redirects to login when unauthenticated.

## Tasks
- T1 (S1): Backend user model + Alembic migration + password hashing + seed from env + login endpoint + auth dependency protecting `/api/v1`. Route: inline. Status: done.
- T2 (S2): TOTP enrollment/verification endpoints + encrypted secret storage + login flow requiring second factor. Route: inline. Status: done.
- T3 (S3): Frontend login page + session check + logout + protected routes. Route: inline. Status: done.
- T4: Docs/changelog, full checks, work-unit commits. Route: inline. Status: done.

## Log
- L1: User original request (verbatim): "habria que hacer un acceso porque esto esta ahora en internet y no quiero que nadie vea informacion. Habria que configurar un usuario y contraseña con doblefactor. El usuario es ecarracedo con el correo ecarracedo@@gmail.com y contraseña [REDACTED - never stored] cifrada en la base de datos" and confirmations: password will be changed later; email is `ecarracedo@gmail.com`; "Vamos con todo".
- L2 (2026-11-07): Implemented S1-S3. Evidence: backend `python -m pytest backend/tests -q` → 215 passed; frontend `npm test` → 29 files, 178 tests passed; `npm run build` passed; `npm run lint` → 0 errors (1 pre-existing warning in QuickOrderCard). Work-unit commits: 713d7a3 (backend auth+TOTP), cd38dc6 (frontend login/gate/TOTP settings), 55a0ecb (lint fix). Deployed to Coolify on VPS (HostGator, Ubuntu, 4 GB) via Docker Compose from `main` with GitHub webhook auto-deploy; user logged in and enabled TOTP; restored local Postgres data-only backup (42 positions, 85 transactions) into Coolify Postgres; PPI quote for SHC.PLUS.A initially unavailable, later resolved. Risk: item 2 (security — auth, sessions, secrets).
