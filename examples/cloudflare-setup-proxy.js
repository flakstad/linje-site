// Minimal Cloudflare Worker proxy for linje-site -> Linje /admin/setup.
//
// Required Worker secrets/env:
// - LINJE_BASE_URL   e.g. "https://api.linje.systems"
// - LINJE_ADMIN_TOKEN
//
// Optional:
// - ALLOWED_ORIGIN   e.g. "https://linje.systems"

function json(status, payload, origin) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  };
  if (origin) {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "origin";
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

function sanitizePayload(body) {
  const payload = {
    "project-id": String(body["project-id"] || "").trim(),
    "project-webhook-url": String(body["project-webhook-url"] || "").trim()
  };

  const fromDomains = Array.isArray(body["from-domains"])
    ? body["from-domains"].map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  if (fromDomains.length) payload["from-domains"] = fromDomains;

  const createInbox = !!body["create-inbox"];
  if (createInbox || body["inbox-id"] || body["inbox-webhook-url"] || body["inbox-secret"]) {
    payload["create-inbox"] = true;
    if (body["inbox-id"]) payload["inbox-id"] = String(body["inbox-id"]).trim();
    if (body["inbox-webhook-url"])
      payload["inbox-webhook-url"] = String(body["inbox-webhook-url"]).trim();
    if (body["inbox-secret"]) payload["inbox-secret"] = String(body["inbox-secret"]).trim();
  }

  return payload;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "";
    const corsOrigin = allowedOrigin && origin === allowedOrigin ? origin : "";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": corsOrigin || "*",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type, idempotency-key"
        }
      });
    }

    if (request.method !== "POST") {
      return json(405, { ok: false, error: "method not allowed" }, corsOrigin);
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json(400, { ok: false, error: "invalid json" }, corsOrigin);
    }

    const payload = sanitizePayload(body || {});
    if (!payload["project-id"]) {
      return json(400, { ok: false, error: "project-id required" }, corsOrigin);
    }
    if (payload["create-inbox"] && !payload["inbox-webhook-url"]) {
      return json(400, { ok: false, error: "inbox-webhook-url required when create-inbox is true" }, corsOrigin);
    }

    const idempotencyKey =
      request.headers.get("idempotency-key") ||
      `${payload["project-id"]}:${Date.now()}`;

    const baseUrl = String(env.LINJE_BASE_URL || "").replace(/\/+$/, "");
    if (!baseUrl || !env.LINJE_ADMIN_TOKEN) {
      return json(500, { ok: false, error: "proxy not configured" }, corsOrigin);
    }

    const upstream = await fetch(`${baseUrl}/admin/setup`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.LINJE_ADMIN_TOKEN}`,
        "idempotency-key": idempotencyKey,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const upstreamText = await upstream.text();
    if (!upstream.ok) {
      return json(
        upstream.status,
        {
          ok: false,
          error: "upstream error",
          upstream_status: upstream.status,
          body: upstreamText.slice(0, 500)
        },
        corsOrigin
      );
    }

    let upstreamBody = {};
    try {
      upstreamBody = JSON.parse(upstreamText);
    } catch (_) {
      upstreamBody = { ok: true };
    }

    // Do not return full secrets to the browser by default.
    return json(
      200,
      {
        ok: true,
        project: upstreamBody.project || null,
        inbox: upstreamBody.inbox ? { id: upstreamBody.inbox.id, address: upstreamBody.inbox.address } : null,
        next_steps: upstreamBody["next-steps"] || null
      },
      corsOrigin
    );
  }
};
