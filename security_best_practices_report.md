# Security Remediation Report

## Executive Summary

The previously identified security issues have been remediated in the codebase, docs, and deployment examples. The app now has production password safety checks, login throttling, security headers, same-origin protection for unsafe API methods, guarded outbound notification URLs, masked notification secrets in the UI/API, safer cookie defaults, and a non-root Docker runtime.

One risk is intentionally left as a documented tradeoff: notification secrets are still stored in SQLite so the single-admin self-hosted app can send reminders after restart. They are no longer returned to the browser in plaintext.

## Fixed Items

### SEC-001: Admin Credential Defaults and Examples

- Status: Fixed
- Changes:
  - Production startup now rejects missing or unsafe `DEFAULT_ADMIN_PASSWORD` values.
  - Runtime fallback changed to `change-me-before-start`.
  - `.env.example` and README compose examples use `change-me-before-start` instead of a real login password.
  - README now tells operators to set their own strong password before production use.

### SEC-002: Login Brute-force Protection

- Status: Fixed
- Changes:
  - `/api/auth/login` now uses `express-rate-limit`.
  - Failed login attempts are limited to 10 per 15 minutes per client.
  - Successful login attempts are skipped by the limiter.

### SEC-003: Cookie-authenticated Write Protection

- Status: Fixed
- Changes:
  - Unsafe methods now require `X-Schedule-Reminder-Request: fetch`.
  - If `Origin` or `Referer` is present, the host must match the request host.
  - The React API client sends the required header automatically.
  - Enterprise WeCom callback handling remains excluded so external callbacks still work.

### SEC-004: Security Headers and Express Fingerprinting

- Status: Fixed
- Changes:
  - Added Helmet-based headers.
  - Disabled `X-Powered-By`.
  - Added CSP, `nosniff`, referrer policy, frame protection, and related hardening headers.
  - HSTS is explicitly disabled to avoid breaking NAS / HTTP-only deployments.

### SEC-005: Outbound Notification URL Guardrails

- Status: Fixed
- Changes:
  - Bark and WeCom outbound URLs are validated before fetch.
  - HTTPS is required by default.
  - Private, loopback, and local addresses are blocked by default, including DNS results.
  - Fetch calls now use a timeout and reject redirects.
  - Operators can explicitly enable internal or HTTP notification endpoints with:
    - `ALLOW_PRIVATE_NOTIFICATION_URLS=true`
    - `ALLOW_INSECURE_NOTIFICATION_URLS=true`

### SEC-006: Notification Secret Exposure

- Status: Partially fixed
- Changes:
  - `GET /api/settings/notifications` now returns masked secret values.
  - Saving unchanged masked fields preserves the original stored secret.
  - Bark key and WeCom secret/token/AES fields are password inputs in the UI.
- Remaining tradeoff:
  - Secrets remain stored in SQLite at rest for self-hosted reminder delivery. Encrypting those values would require an external key or secret manager.

### SEC-007: Secure Cookie Defaults

- Status: Fixed
- Changes:
  - Production defaults to `Secure` cookies when `COOKIE_SECURE` / `SESSION_COOKIE_SECURE` is not explicitly set.
  - README keeps `COOKIE_SECURE=false` for HTTP-only NAS examples so local/LAN deployments still work.

### SEC-008: Container Root User

- Status: Fixed
- Changes:
  - Docker runtime now switches to the bundled `node` user.
  - `/app` and `/pnpm` ownership is adjusted before `USER node`.

## Verification

- `pnpm build`: passed
- `pnpm audit --prod`: no known production vulnerabilities
- Runtime header check: CSP, `nosniff`, and frame protection present; no `X-Powered-By`; no HSTS
- Runtime CSRF check: login without the custom header returns 403
- Runtime login check: login with the custom header succeeds
- Runtime cookie check: production default sets `Secure`; explicit `COOKIE_SECURE=false` keeps HTTP/NAS login compatible
- Runtime secret masking check: notification secrets return as `********`
- Runtime password safety check: production startup rejects the placeholder password
