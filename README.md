# linje-site

Public landing + self-serve setup site for Linje.

## Goals

- communicate the product boundary clearly: transactional outbound + inbound webhooks
- provide an API-first setup path for real product integrations
- keep site concerns separate from core control-plane runtime

## Local preview

```bash
cd /Users/andreas/Projects/linje-site
python3 -m http.server 8787
# open http://localhost:8787
```

## Configuration

Edit `site-config.js`:

- `setupEndpoint`: server-side proxy endpoint that accepts JSON POST payloads for setup
- `adminBaseUrl`: shown in generated cURL snippets
- `analyticsEndpoint`: optional endpoint for setup telemetry events

Do not point `setupEndpoint` directly at Linje `/admin/*` from the browser.
The site is public, so admin credentials must stay server-side.

When `setupEndpoint` is empty, generated setup payloads are saved to `localStorage` in demo mode.

## Deploy (GitHub Pages)

This repo includes `.github/workflows/deploy-pages.yml`.

Expected settings in GitHub:

1. Enable Pages for the repository.
2. Source: GitHub Actions.
3. Push to `main` to deploy.

## Setup payload shape

The form generates JSON for `POST /admin/setup` like:

```json
{
  "project-id": "orders-api",
  "project-webhook-url": "https://app.example.com/linje/events",
  "from-domains": ["tx.example.com"],
  "create-inbox": true,
  "inbox-id": "support",
  "inbox-webhook-url": "https://app.example.com/linje/inbound"
}
```

## Proxy to Linje admin API

Recommended proxy behavior:

1. Receive site setup payload over HTTPS.
2. Optionally validate allowed fields before forwarding.
3. Forward to `POST /admin/setup` with `Authorization: Bearer <admin-token>`.
4. Pass through `Idempotency-Key` from the incoming request header if present.
5. Return non-sensitive success/error to browser.

See `examples/cloudflare-setup-proxy.js` for a minimal Worker example.

## Operating notes

- Keep `LINJE_ADMIN_TOKEN` only in server-side secret storage.
- Persist setup attempts in your proxy logs/audit sink for traceability.
- Treat returned credentials (`api-token`, webhook secrets, inbox manage-token) as one-time secrets.
