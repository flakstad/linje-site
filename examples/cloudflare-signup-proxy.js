// Minimal Cloudflare Worker proxy for linje-site signup submissions.
//
// Required Worker secrets/env:
// - LINJE_SIGNUP_URL  e.g. "https://api.linje.systems/admin/signups" or your account-service endpoint
// - LINJE_ADMIN_TOKEN (optional; required only if your upstream needs bearer auth)
//
// Optional:
// - ALLOWED_ORIGIN    e.g. "https://linje.systems"

function pick(body, keys) {
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null) return body[key];
  }
  return undefined;
}

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
          "access-control-allow-headers": "content-type"
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

    const capturedAt = Number(
      pick(body, ["captured-at", "captured_at_ms", "captured_at_epoch_ms"]) || Date.now()
    );
    const email = String(pick(body, ["email"]) || "").trim().toLowerCase();
    const company = String(pick(body, ["company"]) || "").trim();
    const useCase = String(pick(body, ["use-case", "use_case"]) || "").trim();
    const consent = !!pick(body, ["consent"]);

    if (!email || !company || !useCase || !consent) {
      return json(400, { ok: false, error: "missing required signup fields" }, corsOrigin);
    }

    const payload = {
      intent: "account-signup",
      email,
      company,
      name: pick(body, ["name"]),
      volume: pick(body, ["volume"]),
      "use-case": useCase,
      consent,
      source: String(pick(body, ["source"]) || "linje-site"),
      "page-url": String(pick(body, ["page-url", "page_url", "page"]) || ""),
      "utm-source": String(pick(body, ["utm-source", "utm_source"]) || ""),
      "utm-medium": String(pick(body, ["utm-medium", "utm_medium"]) || ""),
      "utm-campaign": String(pick(body, ["utm-campaign", "utm_campaign"]) || ""),
      "captured-at": Number.isFinite(capturedAt) ? capturedAt : Date.now()
    };

    const idempotencyKey =
      String(pick(body, ["idempotency_key"]) || `${payload.email}:${payload["captured-at"]}`);

    const signupUrl = String(env.LINJE_SIGNUP_URL || "").trim();
    if (!signupUrl) {
      return json(500, { ok: false, error: "proxy not configured" }, corsOrigin);
    }

    const headers = {
      "idempotency-key": idempotencyKey,
      "content-type": "application/json"
    };
    if (env.LINJE_ADMIN_TOKEN) {
      headers.authorization = `Bearer ${env.LINJE_ADMIN_TOKEN}`;
    }

    const upstream = await fetch(signupUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return json(
        upstream.status,
        {
          ok: false,
          error: "upstream error",
          upstream_status: upstream.status,
          body: text.slice(0, 500)
        },
        corsOrigin
      );
    }

    return json(200, { ok: true }, corsOrigin);
  }
};
