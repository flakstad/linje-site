# linje-site

Public landing + account signup site for Linje.

## Goals

- communicate the product boundary clearly: transactional outbound + inbound webhooks
- capture account signups for access to the logged-in API/admin system
- keep marketing/site concerns separate from core control-plane runtime

## Local preview

```bash
cd /Users/andreas/Projects/linje-site
python3 -m http.server 8787
# open http://localhost:8787
```

## Configuration

Edit `site-config.js`:

- `signupEndpoint`: server-side endpoint that accepts JSON signup payloads
- `analyticsEndpoint`: optional endpoint for conversion events

Do not point `signupEndpoint` directly at Linje `/admin/*` from the browser.
The site is public, so admin credentials must stay server-side.

When `signupEndpoint` is empty, submissions are saved to `localStorage` in demo mode.

## Deploy (GitHub Pages)

This repo includes `.github/workflows/deploy-pages.yml`.

Expected settings in GitHub:

1. Enable Pages for the repository.
2. Source: GitHub Actions.
3. Push to `main` to deploy.

## Signup payload shape

Form sends JSON like:

```json
{
  "intent": "account-signup",
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

## Proxy pattern

Recommended server-side behavior:

1. Receive signup payload over HTTPS.
2. Validate required fields and normalize keys.
3. Forward into your account provisioning workflow (or temporary signup intake API).
4. Preserve `idempotency_key` for safe retries.
5. Return non-sensitive success/error to browser.

See `examples/cloudflare-signup-proxy.js` for a minimal Worker example.
