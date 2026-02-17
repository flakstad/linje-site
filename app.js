(function () {
  "use strict";

  var config = Object.assign(
    {
      setupEndpoint: "",
      adminBaseUrl: "http://localhost:8080",
      analyticsEndpoint: "",
      source: "linje-site"
    },
    window.LinjeSiteConfig || {}
  );

  function getQueryParams() {
    var out = {};
    var params = new URLSearchParams(window.location.search);
    params.forEach(function (value, key) {
      out[key] = value;
    });
    return out;
  }

  function pushDataLayer(eventName, payload) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: eventName }, payload || {}));
  }

  function sendAnalytics(eventName, payload) {
    pushDataLayer(eventName, payload);
    if (!config.analyticsEndpoint) return;

    var body = JSON.stringify({
      event: eventName,
      payload: payload || {},
      ts: new Date().toISOString(),
      source: config.source
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(config.analyticsEndpoint, body);
      return;
    }

    fetch(config.analyticsEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body,
      keepalive: true
    }).catch(function () {});
  }

  function setStatus(text, klass) {
    var el = document.getElementById("form-status");
    if (!el) return;
    el.textContent = text || "";
    el.className = "form-status" + (klass ? " " + klass : "");
  }

  function uniq(items) {
    var out = [];
    items.forEach(function (item) {
      if (out.indexOf(item) === -1) out.push(item);
    });
    return out;
  }

  function parseDomainList(raw) {
    return uniq(
      String(raw || "")
        .split(/[\n,]/)
        .map(function (v) {
          return String(v || "").trim();
        })
        .filter(Boolean)
    );
  }

  function readForm(form) {
    var fd = new FormData(form);
    var inboxId = String(fd.get("inbox_id") || "").trim();
    var inboxWebhookUrl = String(fd.get("inbox_webhook_url") || "").trim();
    var inboxSecret = String(fd.get("inbox_secret") || "").trim();
    var createInboxChecked = !!fd.get("create_inbox");

    return {
      projectId: String(fd.get("project_id") || "").trim(),
      projectWebhookUrl: String(fd.get("project_webhook_url") || "").trim(),
      fromDomains: parseDomainList(fd.get("from_domains")),
      createInbox: createInboxChecked || !!inboxId || !!inboxWebhookUrl || !!inboxSecret,
      inboxId: inboxId,
      inboxWebhookUrl: inboxWebhookUrl,
      inboxSecret: inboxSecret
    };
  }

  function validate(model) {
    if (!model.projectId) return "Project ID is required.";
    if (model.createInbox && !model.inboxWebhookUrl) {
      return "Inbox webhook URL is required when creating an inbox.";
    }
    return "";
  }

  function buildPayload(model) {
    var payload = {
      "project-id": model.projectId
    };

    if (model.projectWebhookUrl) payload["project-webhook-url"] = model.projectWebhookUrl;
    if (model.fromDomains.length) payload["from-domains"] = model.fromDomains;

    if (model.createInbox) {
      payload["create-inbox"] = true;
      if (model.inboxId) payload["inbox-id"] = model.inboxId;
      payload["inbox-webhook-url"] = model.inboxWebhookUrl;
      if (model.inboxSecret) payload["inbox-secret"] = model.inboxSecret;
    }

    return payload;
  }

  function persistFallback(payload, idempotencyKey) {
    var key = "linje_site_setups";
    var existing = [];
    try {
      existing = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(existing)) existing = [];
    } catch (_) {
      existing = [];
    }
    existing.push({
      payload: payload,
      idempotency_key: idempotencyKey,
      created_at: new Date().toISOString()
    });
    localStorage.setItem(key, JSON.stringify(existing));
  }

  function shEscapeSingleQuoted(s) {
    return String(s || "").replace(/'/g, "'\"'\"'");
  }

  function buildCurl(payload, idempotencyKey) {
    var base = String(config.adminBaseUrl || "http://localhost:8080").replace(/\/+$/, "");
    var json = JSON.stringify(payload);
    return [
      "curl -sS -X POST \"" + base + "/admin/setup\"",
      "  -H \"Authorization: Bearer $LINJE_ADMIN_TOKEN\"",
      "  -H \"Idempotency-Key: " + idempotencyKey + "\"",
      "  -H \"Content-Type: application/json\"",
      "  --data-raw '" + shEscapeSingleQuoted(json) + "'"
    ].join(" \\\n");
  }

  function renderPreview(payload, idempotencyKey) {
    var setupEl = document.querySelector("#setup-preview code");
    var curlEl = document.querySelector("#curl-preview code");
    if (setupEl) setupEl.textContent = JSON.stringify(payload, null, 2);
    if (curlEl) curlEl.textContent = buildCurl(payload, idempotencyKey);
  }

  function attachRevealObserver() {
    var nodes = document.querySelectorAll("[data-reveal]");
    if (!nodes.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    nodes.forEach(function (n) {
      observer.observe(n);
    });
  }

  function attachCtaTracking() {
    document.querySelectorAll("[data-track]").forEach(function (el) {
      el.addEventListener("click", function () {
        sendAnalytics("cta_click", {
          id: el.getAttribute("data-track"),
          path: window.location.pathname
        });
      });
    });
  }

  function attachSetupHandler() {
    var form = document.getElementById("setup-form");
    if (!form) return;

    function refreshPreview() {
      var model = readForm(form);
      var payload = buildPayload(model);
      var idempotencyKey = model.projectId
        ? model.projectId + ":preview"
        : "project-id:preview";
      renderPreview(payload, idempotencyKey);
    }

    form.addEventListener("input", refreshPreview);
    refreshPreview();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setStatus("", "");

      var model = readForm(form);
      var error = validate(model);
      if (error) {
        setStatus(error, "error");
        sendAnalytics("setup_invalid", { reason: error });
        return;
      }

      var payload = buildPayload(model);
      var query = getQueryParams();
      var idempotencyKey = model.projectId + ":" + String(Date.now());
      renderPreview(payload, idempotencyKey);

      var button = form.querySelector("button[type='submit']");
      if (button) button.disabled = true;
      setStatus("Submitting setup request...", "");

      var request = config.setupEndpoint
        ? fetch(config.setupEndpoint, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "idempotency-key": idempotencyKey,
              "x-source": config.source
            },
            body: JSON.stringify(payload)
          })
        : Promise.resolve({ ok: true, fallback: true });

      request
        .then(function (res) {
          if (!res.ok) throw new Error("Setup endpoint returned " + res.status);
          return res.fallback ? { fallback: true } : res.json().catch(function () { return {}; });
        })
        .then(function (resBody) {
          if (resBody.fallback) {
            persistFallback(payload, idempotencyKey);
            setStatus("Setup payload generated and saved locally. Configure setupEndpoint to run live setup.", "ok");
          } else {
            setStatus("Setup submitted. Store returned api-token/webhook secrets securely.", "ok");
          }

          sendAnalytics("setup_submitted", {
            project_id: model.projectId,
            create_inbox: model.createInbox,
            utm_source: query.utm_source || ""
          });
        })
        .catch(function (err) {
          setStatus("Setup failed. Review the generated cURL output or try again.", "error");
          sendAnalytics("setup_failed", { error: String(err && err.message) });
        })
        .finally(function () {
          if (button) button.disabled = false;
        });
    });
  }

  attachRevealObserver();
  attachCtaTracking();
  attachSetupHandler();
})();
