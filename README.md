# linje-site

Public landing, docs, and access-request site for Linje.

## Goals

- communicate the product boundary clearly: transactional outbound + inbound webhooks
- provide an honest access-request path and a clear route into the logged-in portal
- keep marketing/site concerns separate from core control-plane runtime

## Local preview

```bash
cd /Users/andreas/Projects/linje-site
python3 -m http.server 8787
# open http://localhost:8787
```

## Configuration

Edit `site-config.js`:

- `analyticsEndpoint`: optional endpoint for conversion events

## Deploy (GitHub Pages)

This repo includes `.github/workflows/deploy-pages.yml`.
It also includes `CNAME`, so the Pages artifact declares the production domain `linje.systems`.

Expected settings in GitHub:

1. Enable Pages for the repository.
2. Source: GitHub Actions.
3. Set the custom domain to `linje.systems` in the Pages settings if GitHub has not picked it up automatically.
4. Push to `main` to deploy.

Access requests currently use a direct `mailto:hello@linje.systems` flow. Existing customers sign
in at `https://api.linje.systems/portal/login`. Do not add a browser-side signup endpoint that
requires Linje admin credentials; any future intake integration must keep those credentials
server-side.
