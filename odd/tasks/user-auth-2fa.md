# User authentication with 2FA
Objective: protect the deployed single-user app with login (hashed password) + TOTP second factor. Branch: dev. Test runner: backend `python -m pytest backend/tests -q`, frontend `npx vitest run`.

## Specs
- S1: "Login con usuario + contraseña hasheada en Postgres" — user `ecarracedo`, email `ecarracedo@gmail.com`, password stored only as hash, never plaintext in repo.
- S2: "2FA con código TOTP (tipo Google Authenticator)" — enrollment with QR/otpauth, verification on login.
- S3: "Protección en backend + pantalla de login en el frontend" — all `/api/v1` routes require auth; frontend redirects to login when unauthenticated.

## Tasks
- T1 (S1): Backend user model + Alembic migration + password hashing + seed from env + login endpoint + auth dependency protecting `/api/v1`. Route: inline. Status: done.
- T2 (S2): TOTP enrollment/verification endpoints + encrypted secret storage + login flow requiring second factor. Route: inline. Status: done.
- T3 (S3): Frontend login page + session check + logout + protected routes. Route: inline. Status: pending.
- T4: Docs/changelog, full checks, work-unit commits. Route: inline. Status: pending.

## Log
- L1: User original request (verbatim): "habria que hacer un acceso porque esto esta ahora en internet y no quiero que nadie vea informacion. Habria que configurar un usuario y contraseña con doblefactor. El usuario es ecarracedo con el correo ecarracedo@@gmail.com y contraseña [REDACTED - never stored] cifrada en la base de datos" and confirmations: password will be changed later; email is `ecarracedo@gmail.com`; "Vamos con todo".
