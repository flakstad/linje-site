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

- `signupEndpoint`: webhook/API endpoint that accepts JSON POST payloads
- `analyticsEndpoint`: optional endpoint for conversion events

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
  "consent": true,
  "source": "linje-site",
  "page": "https://linje.example/?utm_source=...",
  "captured_at": "2026-02-17T12:34:56.000Z",
  "utm_source": "...",
  "utm_medium": "...",
  "utm_campaign": "..."
}
```

## Handoff to pilot onboarding

- Route `signupEndpoint` to a durable sink (e.g., webhook service / CRM / DB)
- Alert on failed endpoint calls
- Review incoming leads daily and provision candidate projects in core Linje
