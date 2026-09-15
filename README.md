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

`site-config.js` is safe to load when analytics are not configured. Local previews remain a no-op
and log a clear warning. Supported values:

- `analyticsEndpoint`: optional endpoint for conversion events
- `posthogKey`: PostHog project token, injected during the Pages build
- `posthogHost`: PostHog ingest host; defaults to EU Cloud
- `posthogDebug`: enable PostHog debug output locally

The Pages workflow reads these GitHub repository variables:

- `LINJE_POSTHOG_KEY` — the public project token from a dedicated Linje PostHog project
- `LINJE_POSTHOG_HOST` — optional; defaults to `https://eu.i.posthog.com`

Do not reuse a PostHog project belonging to another product. The current CLI context points at a
Fangst/andreasflakstad.no project and must not receive Linje events.

The public site captures:

- automatic `$pageview` and `$pageleave` events
- `cta_click` for elements with `data-track`
- `access_request_started` when the visitor opens the email access flow

Every event carries `surface`, `first_surface`, and first-touch UTM properties. The integration
uses PostHog's always-on cookieless mode, disables autocapture and session replay, does not create
person profiles, strips query strings from captured URLs, and sends `$ip: null`. First-touch values
live only in the browser tab's session storage. Do not add email addresses, form contents, message
bodies, attachment names, or application metadata to event properties.

Enable **Cookieless server hash mode** under PostHog project settings before setting the token;
PostHog ignores cookieless events when the project-side setting is disabled.

## Google Search Console

The repository already exposes `robots.txt` and `sitemap.xml`. Complete the external setup after
deployment:

1. Create a **Domain property** for `linje.systems` in Google Search Console.
2. Add Google's verification TXT record to DNS and verify the property.
3. Submit `https://linje.systems/sitemap.xml`.
4. Inspect the five market-surface URLs and request indexing if Google has not discovered them.
5. Use query, page, and country reports as the acquisition layer; use PostHog for on-site CTA and
   access-flow behavior.

DNS verification and Search Console property creation are external production changes and are not
performed by this repository.

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
