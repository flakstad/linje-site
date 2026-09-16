# linje-site

Public landing, docs, and self-service acquisition site for Linje.

## Goals

- communicate the product boundary clearly: transactional outbound + inbound webhooks
- provide an honest free-preview path and a clear route into self-service signup
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
- `landing_view` as the stable first step in the commercial funnel
- `cta_click` for elements with `data-track`
- `signup_started` when the visitor follows a self-service CTA

Every event carries `surface`, `first_surface`, `entry_path`, and first-touch UTM properties. Portal
links carry the same bounded attribution plus PostHog's opaque anonymous id through magic-link
signup, allowing server-side activation events to join the acquisition journey. The integration
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
4. Inspect the six market-surface URLs and request indexing if Google has not discovered them.
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

New and existing users sign in at `https://api.linje.systems/portal/login`; a first login creates
the account automatically. Do not add a browser-side endpoint that requires Linje admin
credentials.
