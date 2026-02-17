# linje-site

Public landing + pilot signup site for Linje.

## Goals

- communicate the product boundary clearly: transactional outbound + inbound webhooks
- convert qualified pilot leads via signup form
- keep marketing/site concerns separate from core control-plane runtime

## Local preview

```bash
cd /Users/andreas/Projects/linje-site
python3 -m http.server 8787
# open http://localhost:8787
```

## Configuration

Edit `site-config.js`:

- `signupEndpoint`: server-side proxy endpoint that accepts JSON POST payloads
- `analyticsEndpoint`: optional endpoint for conversion events

Do not point `signupEndpoint` directly at Linje `/admin/*` from the browser.
The site is public, so admin credentials must stay server-side.

When `signupEndpoint` is empty, form submissions are saved to `localStorage` in demo mode.

## Deploy (GitHub Pages)

This repo includes `.github/workflows/deploy-pages.yml`.

Expected settings in GitHub:

1. Enable Pages for the repository.
2. Source: GitHub Actions.
3. Push to `main` to deploy.

## Lead payload shape

Form sends JSON like:

```json
{
  "email": "you@company.com",
  "company": "Acme Inc",
  "name": "Jane Doe",
  "volume": "10k-100k",
  "use_case": "Password resets + receipts",
  "use-case": "Password resets + receipts",
  "consent": true,
  "source": "linje-site",
  "page": "https://linje.example/?utm_source=...",
  "page-url": "https://linje.example/?utm_source=...",
  "captured_at": "2026-02-17T12:34:56.000Z",
  "captured-at": 1765802096000,
  "utm_source": "...",
  "utm-source": "...",
  "utm_medium": "...",
  "utm-medium": "...",
  "utm_campaign": "...",
  "utm-campaign": "...",
  "idempotency_key": "you@company.com:1765802096000"
}
```

## Proxy to Linje admin API

Recommended proxy behavior:

1. Receive site payload over HTTPS.
2. Normalize keys to Linje admin signup API payload.
3. Forward to `POST /admin/signups` with `Authorization: Bearer <admin-token>`.
4. Set `Idempotency-Key` from `idempotency_key` if present.
5. Return non-sensitive success/error to browser.

See `examples/cloudflare-signup-proxy.js` for a minimal Worker example.

## Handoff to onboarding

- Route `signupEndpoint` to a durable sink (e.g., webhook service / CRM / DB)
- Alert on failed endpoint calls
- Review incoming signups daily and provision candidate projects in core Linje
